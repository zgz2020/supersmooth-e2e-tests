import test from '@playwright/test';
import Ajv, { JSONSchemaType, ValidateFunction } from 'ajv';

const ajv = new Ajv();
const schemaCache = new WeakMap<object, ValidateFunction>();

type ValidateSchemaProps<T> = {
  schema: JSONSchemaType<T>;
  json: T | T[];
};

export const validateSchema = async <T>({ schema, json }: ValidateSchemaProps<T>) => {
  await test.step('Validating json schema', async () => {
    let validate = schemaCache.get(schema);
    if (!validate) {
      validate = ajv.compile(schema);
      schemaCache.set(schema, validate);
    }

    if (!validate(json)) {
      const prettyJson = JSON.stringify(json, null, 2);
      const prettyError = JSON.stringify(validate.errors, null, 2);
      throw Error(`Schema validation error: ${prettyError}\nJSON: ${prettyJson}`);
    }
  });
};
