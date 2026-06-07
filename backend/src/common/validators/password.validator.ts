import {
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

/** 8–128 chars, at least one letter and one digit. */
export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          if (value.length < 8 || value.length > 128) return false;
          return /[a-zA-Z]/.test(value) && /\d/.test(value);
        },
        defaultMessage() {
          return 'Password must be 8–128 characters and include at least one letter and one number';
        },
      },
    });
  };
}
