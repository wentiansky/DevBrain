export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
}

export function validateLogin(
  values: LoginInput,
): Partial<Record<keyof LoginInput, string>> {
  const errors: Partial<Record<keyof LoginInput, string>> = {};
  if (!values.email.trim()) {
    errors.email = '请输入邮箱';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = '邮箱格式无效';
  }
  if (!values.password) {
    errors.password = '请输入密码';
  }
  return errors;
}

export function validateRegister(
  values: RegisterInput,
): Partial<Record<keyof RegisterInput, string>> {
  const errors: Partial<Record<keyof RegisterInput, string>> = {};
  if (!values.email.trim()) {
    errors.email = '请输入邮箱';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = '邮箱格式无效';
  }
  if (!values.password) {
    errors.password = '请输入密码';
  } else if (values.password.length < 8) {
    errors.password = '密码至少 8 个字符';
  } else if (values.password.length > 128) {
    errors.password = '密码最多 128 个字符';
  }
  return errors;
}