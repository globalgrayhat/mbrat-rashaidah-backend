import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { CollectionResponseDto } from '../dto/collection-response.dto';
import { CollectionMetaDto } from '../dto/collection-meta.dto';

export const ApiCollectionResponse = <TModel extends Type<any>>(
  model: TModel,
) => {
  return applyDecorators(
    ApiExtraModels(CollectionResponseDto, CollectionMetaDto, model),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(CollectionResponseDto) },
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
              meta: {
                $ref: getSchemaPath(CollectionMetaDto),
              },
            },
          },
        ],
      },
    }),
  );
};
