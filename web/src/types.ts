// The same shapes as the DTOs of the API.

export type Role = 'student' | 'referent';

export interface Me {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  initiationValidated: boolean;
}

export interface NewAccount {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}
