import * as bcrypt from 'bcrypt';

export const TEST_PASSWORD = 'TestPassword123!';
export const TEST_PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 12);

export const testUsers = {
  owner: {
    email: 'owner@test.com',
    password: TEST_PASSWORD,
    passwordHash: TEST_PASSWORD_HASH,
    name: 'Test Owner',
  },
  admin: {
    email: 'admin@test.com',
    password: TEST_PASSWORD,
    passwordHash: TEST_PASSWORD_HASH,
    name: 'Test Admin',
  },
  member: {
    email: 'member@test.com',
    password: TEST_PASSWORD,
    passwordHash: TEST_PASSWORD_HASH,
    name: 'Test Member',
  },
  viewer: {
    email: 'viewer@test.com',
    password: TEST_PASSWORD,
    passwordHash: TEST_PASSWORD_HASH,
    name: 'Test Viewer',
  },
  newUser: {
    email: 'newuser@test.com',
    password: TEST_PASSWORD,
    name: 'New Test User',
    tenantName: 'New User Workspace',
  },
};

export function createUserFixture(overrides?: Partial<typeof testUsers.owner>) {
  return {
    ...testUsers.owner,
    ...overrides,
  };
}
