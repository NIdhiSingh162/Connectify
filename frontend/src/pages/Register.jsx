import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../services/api";

function Register() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();

    try {
      await API.post("/auth/register", {
        name,
        email,
        password,
      });

      alert("Registration successful");
      navigate("/login");
    } catch (error) {
      alert("Registration failed");
      console.log(error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-4">
      <div className="w-full max-w-md bg-white/10 border border-white/10 rounded-3xl p-8 shadow-2xl backdrop-blur">
        <h1 className="text-4xl font-bold text-center text-cyan-300 mb-2">
          Connectify
        </h1>

        <p className="text-center text-slate-300 mb-8">
          Create your account
        </p>

        <form onSubmit={handleRegister} className="space-y-5">
          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full p-4 rounded-2xl bg-white/10 border border-white/10 text-white placeholder-slate-400 outline-none focus:border-cyan-400"
          />

          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full p-4 rounded-2xl bg-white/10 border border-white/10 text-white placeholder-slate-400 outline-none focus:border-cyan-400"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full p-4 rounded-2xl bg-white/10 border border-white/10 text-white placeholder-slate-400 outline-none focus:border-cyan-400"
          />

          <button
            type="submit"
            className="w-full bg-cyan-500 text-slate-950 py-4 rounded-2xl font-bold hover:bg-cyan-400 transition"
          >
            Register
          </button>
        </form>

        <p className="text-center text-slate-300 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-cyan-300 font-semibold">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Register;