interface LoginFormProps {
  errorMessage?: string;
}

export default function LoginForm({ errorMessage }: LoginFormProps) {
  return (
    <form className="form-grid" method="post" action="/auth/login">
      <div className="field">
        <label htmlFor="username">用户名</label>
        <input
          id="username"
          name="username"
          className="input"
          autoComplete="username"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="password">密码</label>
        <input
          id="password"
          name="password"
          className="input"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {errorMessage ? <div className="notice notice-error">{errorMessage}</div> : null}
      <button className="button button-primary" type="submit">
        登录
      </button>
    </form>
  );
}
