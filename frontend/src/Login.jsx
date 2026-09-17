import React, { useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");

    if (!API) {
      setError("API URL is not configured.");
      return;
    }

    setLoading(true);

    try {
      if (isRegister) {
        /* REGISTER */

        const response = await axios.post(
          `${API}/api/register`,
          {
            name,
            email,
            password,
          }
        );

        console.log("Registration response:", response.data);

        alert("Registration successful! Please login.");

        setIsRegister(false);
        setName("");
        setPassword("");
      } else {
        /* LOGIN */

        const response = await axios.post(
          `${API}/api/login`,
          {
            email,
            password,
          }
        );

        console.log("Login response:", response.data);

        const { token, user } = response.data;

        /* Save JWT token */
        localStorage.setItem("token", token);

        /* Save user */
        localStorage.setItem(
          "user",
          JSON.stringify(user)
        );

        /* Send user to App.jsx */
        onLogin(user);
      }
    } catch (err) {
      console.error("Authentication error:", err);

      setError(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">

      <div className="auth-card">

        <div className="auth-logo">
          🚨
        </div>

        <h1>Emergency Response</h1>

        <p className="auth-subtitle">
          {isRegister
            ? "Create your account"
            : "Sign in to access emergency services"}
        </p>

        {error && (
          <div className="auth-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>

          {isRegister && (
            <div className="form-group">

              <label>Full Name</label>

              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                required
              />

            </div>
          )}

          <div className="form-group">

            <label>Email</label>

            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              required
            />

          </div>

          <div className="form-group">

            <label>Password</label>

            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              required
              minLength={6}
            />

          </div>

          <button
            type="submit"
            className="auth-button"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : isRegister
              ? "CREATE ACCOUNT"
              : "LOGIN"}
          </button>

        </form>

        <div className="auth-switch">

          {isRegister
            ? "Already have an account?"
            : "Don't have an account?"}

          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError("");
            }}
          >
            {isRegister ? "Login" : "Register"}
          </button>

        </div>

      </div>

    </div>
  );
}

export default Login;