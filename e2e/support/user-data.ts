export type E2EUser = {
  name: string;
  email: string;
  password: string;
};

export function createE2EUser(): E2EUser {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;

  return {
    name: "E2E User",
    email: `genum_e2e_${suffix}@example.com`,
    password: "Test1234!",
  };
}
