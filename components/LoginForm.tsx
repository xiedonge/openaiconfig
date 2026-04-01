const TEXT = {
  username: "\u7528\u6237\u540d",
  password: "\u5bc6\u7801",
  submit: "\u767b\u5f55",
} as const;

interface LoginFormProps {
  errorMessage?: string;
}

export default function LoginForm({ errorMessage }: LoginFormProps) {
  return (
    <form className="form-grid" method="post" action="/auth/login">
      <div className="field">
        <label htmlFor="username">{TEXT.username}</label>
        <input id="username" name="username" className="input" autoComplete="username" required />
      </div>
      <div className="field">
        <label htmlFor="password">{TEXT.password}</label>
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
        {TEXT.submit}
      </button>
    </form>
  );
}
