export class AuthResponseDto {
  access_token: string;
  refresh_token: string;
  user_id: string;
  store_id: string;
  role: 'owner' | 'cashier';
  full_name: string | null;
  license_status?: string;
  license_expires_at?: Date | null;
  expires_in?: number; // Tiempo de expiración del access token en segundos
}
