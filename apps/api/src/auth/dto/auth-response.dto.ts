export class AuthResponseDto {
  access_token: string;
  user_id: string;
  store_id: string;
  role: 'owner' | 'cashier';
  full_name: string | null;
}

