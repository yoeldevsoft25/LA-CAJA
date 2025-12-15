import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const ROLES = ['owner', 'cashier'] as const;
export type AdminUserRole = (typeof ROLES)[number];

export class AdminCreateUserDto {
  @IsString()
  @MinLength(1)
  full_name: string;

  @IsIn(ROLES as any)
  role: AdminUserRole;

  @IsOptional()
  @IsString()
  @MinLength(4)
  pin?: string;

  @IsOptional()
  @IsString()
  user_id?: string; // Permite vincular un usuario existente
}
