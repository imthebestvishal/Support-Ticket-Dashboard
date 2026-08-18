import { createAuthClient } from "@neondatabase/neon-js/auth";

const authUrl = import.meta.env.VITE_NEON_AUTH_URL;

let authClientInstance: any = null;

if (authUrl) {
  try {
    authClientInstance = createAuthClient(authUrl);
  } catch (err) {
    console.warn("Failed to initialize Neon Auth client, falling back to mock:", err);
  }
}

if (!authClientInstance) {
  console.warn("Neon Auth is running in mock/demo mode since VITE_NEON_AUTH_URL is not configured.");
  
  // Custom mock client for localStorage-backed simulation
  const usersKey = "mock_users";
  const sessionKey = "mock_session";
  const legacyUserKey = "mock_user";

  function readMockUsers() {
    try {
      const users = localStorage.getItem(usersKey);
      return users ? JSON.parse(users) : {};
    } catch {
      return {};
    }
  }

  function writeMockUsers(users: Record<string, any>) {
    localStorage.setItem(usersKey, JSON.stringify(users));
  }

  authClientInstance = {
    signUp: {
      email: async ({ email, password, name }: any) => {
        const normalizedEmail = String(email || "").trim().toLowerCase();

        if (!normalizedEmail || !password) {
          return { error: { message: "Email and password are required" } };
        }

        const users = readMockUsers();

        if (users[normalizedEmail]) {
          return { error: { message: "An account already exists for this email" } };
        }

        users[normalizedEmail] = {
          email: normalizedEmail,
          name: name || normalizedEmail.split("@")[0],
          password,
        };

        writeMockUsers(users);
        localStorage.setItem(
          legacyUserKey,
          JSON.stringify({ email: normalizedEmail, name: users[normalizedEmail].name })
        );

        return { data: { success: true }, error: null };
      }
    },
    signIn: {
      email: async ({ email, password }: any) => {
        const normalizedEmail = String(email || "").trim().toLowerCase();
        const users = readMockUsers();
        const mockUser = users[normalizedEmail];

        if (mockUser && mockUser.password === password) {
          const sessionUser = {
            email: mockUser.email,
            name: mockUser.name,
          };

          localStorage.setItem(sessionKey, JSON.stringify(sessionUser));
          localStorage.setItem(legacyUserKey, JSON.stringify(sessionUser));
          return { data: { session: { user: sessionUser } }, error: null };
        }

        return { error: { message: "Invalid email or password" } };
      }
    },
    getSession: async () => {
      const sessionStr = localStorage.getItem(sessionKey);
      const user = sessionStr ? JSON.parse(sessionStr) : null;

      if (user) {
        return { data: { session: { user } }, error: null };
      }

      return { data: null, error: null };
    },
    signOut: async () => {
      localStorage.removeItem(sessionKey);
      return { data: { success: true }, error: null };
    }
  };
}

export const authClient = authClientInstance;
