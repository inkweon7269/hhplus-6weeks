import { ValidateBy, ValidationOptions } from 'class-validator';

export function IsMultipleOfHundred(validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isMultipleOfHundred',
      validator: {
        validate: (value: any) => typeof value === 'number' && value % 100 === 0,
        defaultMessage: () => '충전 금액은 100원 단위로만 입력 가능합니다.',
      },
    },
    validationOptions,
  );
}
