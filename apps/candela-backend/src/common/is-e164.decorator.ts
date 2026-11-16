import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { isE164Phone } from '@candela/shared';

/** Allows null/undefined when combined with @IsOptional / @ValidateIf. */
export function IsE164Phone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isE164Phone',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (value === null || value === undefined) return true;
          if (typeof value !== 'string') return false;
          return isE164Phone(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be an E.164 number (e.g. +919876543210)`;
        },
      },
    });
  };
}
