import { IsString, IsIn, Matches } from 'class-validator';

// UUID permisivo
const RELAXED_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ResolveConflictDto {
  @Matches(RELAXED_UUID_REGEX, { message: 'conflict_id must be a UUID' })
  conflict_id: string;

  @IsString()
  @IsIn(['keep_mine', 'take_theirs'], {
    message: 'resolution must be either "keep_mine" or "take_theirs"',
  })
  resolution: 'keep_mine' | 'take_theirs';
}
