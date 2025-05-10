import React, { useState } from "react";
import axios from "axios";
import {
  FaUser,
  FaEnvelope,
  FaLock,
  FaSignInAlt,
  FaUserPlus,
} from "react-icons/fa";
import logo from "../assets/wlogo.png";
import { API_BASE_URL } from "../config";

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = isLogin
        ? `${API_BASE_URL}/login`
        : `${API_BASE_URL}/signup`;
      const payload = isLogin
        ? { username, password }
        : { username, email, password };

      const response = await axios.post(endpoint, payload);

      if (isLogin) {
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("userId", response.data.userId);
        localStorage.setItem("username", response.data.username);
        window.location.href = "/home";
      } else {
        setIsLogin(true);
      }
    } catch (err) {
      setError(err.response?.data?.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] to-[#1a1a1a] flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="bg-[#1a1a1a] rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,255,0.2)] border border-blue-900/30 p-8 transform transition-all duration-300 hover:shadow-[0_20px_60px_-10px_rgba(0,0,255,0.3)]">
          <div className="flex flex-col items-center w-full justify-center mb-6">
            <div className="relative mb-2">
              <div className="absolute inset-0 bg-blue-500 rounded-full blur-md opacity-30"></div>
              <img
                src={logo}
                className="w-20 h-20 relative z-10"
                alt="GCN Logo"
              />
            </div>
            <h2 className="text-white font-bold text-3xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
              GCN
            </h2>
          </div>

          <h2 className="text-center text-3xl font-light text-white mb-2">
            {isLogin ? "Welcome Back" : "Create Account"}
          </h2>
          <p className="text-center text-gray-400 mb-8">
            {isLogin
              ? "Sign in to continue to your account"
              : "Register to create a new account"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="relative group">
              <FaUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 group-hover:text-blue-400 transition-colors duration-300" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                required
                className="w-full pl-10 pr-3 py-3.5 bg-[#2a2a2a] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all duration-300"
              />
            </div>

            {!isLogin && (
              <div className="relative group">
                <FaEnvelope className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 group-hover:text-blue-400 transition-colors duration-300" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  required={!isLogin}
                  className="w-full pl-10 pr-3 py-3.5 bg-[#2a2a2a] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all duration-300"
                />
              </div>
            )}

            <div className="relative group">
              <FaLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 group-hover:text-blue-400 transition-colors duration-300" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="w-full pl-10 pr-3 py-3.5 bg-[#2a2a2a] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all duration-300"
              />
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-500/30 text-red-400 text-center p-3 rounded-lg animate-pulse">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 rounded-lg text-white font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                loading
                  ? "bg-blue-800/50 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 shadow-lg hover:shadow-blue-500/20"
              }`}
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  {isLogin ? <FaSignInAlt /> : <FaUserPlus />}
                  <span>{isLogin ? "Sign In" : "Sign Up"}</span>
                </>
              )}
            </button>
          </form>

          <div className="text-center mt-8 border-t border-gray-800 pt-6">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-gray-400 hover:text-blue-400 transition-colors flex items-center gap-2 mx-auto"
            >
              {isLogin ? (
                <>
                  <FaUserPlus className="text-blue-500" />
                  <span>
                    Don't have an account?{" "}
                    <span className="text-blue-400 font-medium">Sign Up</span>
                  </span>
                </>
              ) : (
                <>
                  <FaSignInAlt className="text-blue-500" />
                  <span>
                    Already have an account?{" "}
                    <span className="text-blue-400 font-medium">Sign In</span>
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
