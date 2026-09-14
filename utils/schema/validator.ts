import Ajv, { AnySchema } from 'ajv';

const ajv = new Ajv({ allErrors: true });

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateSchema(data: unknown, schema: AnySchema): ValidationResult {
  const validate = ajv.compile(schema);
  const valid = validate(data);

  if (valid) {
    return {
      valid: true,
      errors: [],
    };
  }

  const errors = (validate.errors || []).map((err) => {
    const instancePath = err.instancePath ? err.instancePath : 'root';
    return `${instancePath} ${err.message}`;
  });

  return {
    valid: false,
    errors,
  };
}
