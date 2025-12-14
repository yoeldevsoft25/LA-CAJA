import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class CreateStoreDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  name: string;
}

