import { IsStrongPassword } from './password.validator';
import { validate } from 'class-validator';

class TestDto {
  @IsStrongPassword()
  password: string;

  constructor(password: string) {
    this.password = password;
  }
}

describe('IsStrongPassword', () => {
  it('accepts valid passwords', async () => {
    const errors = await validate(new TestDto('SecurePass1'));
    expect(errors).toHaveLength(0);
  });

  it('rejects short passwords', async () => {
    const errors = await validate(new TestDto('abc1'));
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects passwords without digits', async () => {
    const errors = await validate(new TestDto('SecurePass'));
    expect(errors.length).toBeGreaterThan(0);
  });
});
