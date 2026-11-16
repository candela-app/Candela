import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { isHttpsUrl } from '@candela/shared';

export function IsHttpsUrl(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isHttpsUrl',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (value === null || value === undefined || value === '') return true;
          if (typeof value !== 'string') return false;
          return isHttpsUrl(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be an https:// URL`;
        },
      },
    });
  };
}
