import { Injectable, NotFoundException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument, UserRole } from './user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  parsePagination,
  toPaginatedResult,
  type PaginatedResult,
} from '../common/pagination.util';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async create(createUserDto: CreateUserDto): Promise<UserDocument> {
    const existing = await this.userModel.findOne({ email: createUserDto.email });
    if (existing) throw new ConflictException('Email already in use');

    const hashed = await bcrypt.hash(createUserDto.password, 12);
    const user = new this.userModel({ ...createUserDto, password: hashed });
    return user.save();
  }

  async findAll(page?: string, limit?: string): Promise<UserDocument[] | PaginatedResult<UserDocument>> {
    const pagination = parsePagination(page, limit);
    const query = this.userModel.find().select('-password').sort({ createdAt: -1 });

    if (!pagination) {
      return query.exec();
    }

    const [data, total] = await Promise.all([
      query.skip(pagination.skip).limit(pagination.limit).exec(),
      this.userModel.countDocuments().exec(),
    ]);
    return toPaginatedResult(data, total, pagination);
  }

  /** Lightweight auth lookup — used on every JWT-protected request. */
  async findByIdForAuth(id: string) {
    return this.userModel
      .findById(id)
      .select('name email role isActive avatar')
      .lean()
      .exec();
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).select('-password');
    if (!user) throw new NotFoundException('User not found');
    if (!user.isActive) throw new UnauthorizedException('Account is disabled');
    return user;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  /** Batch lookup for bulk CSV import — one query instead of N. */
  async findByEmails(emails: string[]): Promise<Map<string, UserDocument>> {
    const map = new Map<string, UserDocument>();
    if (emails.length === 0) return map;
    const users = await this.userModel
      .find({ email: { $in: emails.map((e) => e.toLowerCase()) } })
      .exec();
    for (const u of users) {
      map.set(u.email.toLowerCase(), u);
    }
    return map;
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserDocument> {
    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 12);
    }
    const user = await this.userModel
      .findByIdAndUpdate(id, dto, { new: true })
      .select('-password');
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateRole(id: string, role: UserRole): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(id, { role }, { new: true })
      .select('-password');
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async remove(id: string): Promise<void> {
    const result = await this.userModel.deleteOne({ _id: id });
    if (result.deletedCount === 0) throw new NotFoundException('User not found');
  }

  async validatePassword(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }
}
