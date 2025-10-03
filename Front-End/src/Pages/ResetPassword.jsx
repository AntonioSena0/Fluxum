import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Logo from "../assets/logo.svg";
import WordPress from "../assets/assetsLogin/wordpress.png";
import Perigo from "../assets/assetsLogin/perigo.png";
import Calendário from "../assets/assetsLogin/calendario.png";
import Seta from "../assets/assetsLogin/seta.png";
import Container from "../assets/assetsLogin/container.png";

export default function ResetPassword() {
  const [sp] = useSearchParams();
  const token = sp.get("token") || "";
  const navigate = useNavigate();

  const [valid, setValid] = useState(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const API = import.meta.env.VITE_API_URL || "";
        const r = await fetch(
          `${API}/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`,
          { credentials: "include" }
        );
        const j = await r.json().catch(() => ({ valid: false }));
        if (!alive) return;
        setValid(!!j.valid);
      } catch {
        if (!alive) return;
        setValid(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  async function handleChange() {
    setErr("");
    const pw = password.trim();
    const cf = confirm.trim();
    if (pw.length < 6) return setErr("Senha precisa ter pelo menos 6 caracteres.");
    if (pw !== cf) return setErr("As senhas não coincidem.");

    setLoading(true);
    try {
      const API = import.meta.env.VITE_API_URL || "";
      const r = await fetch(`${API}/api/auth/reset-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: pw, confirmPassword: cf }),
      });
      if (r.status === 204) {
        navigate("/Login");
        return;
      }
      const j = await r.json().catch(() => ({}));
      setErr(j?.error || "Erro ao redefinir senha");
    } catch {
      setErr("Erro ao redefinir senha");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex justify-center">
      <div className="w-full lg:w-2/4 flex flex-col justify-center items-center lg:items-start p-8 sm:p-16 gap-6">
        <Link to="/">
          <img src={Logo} alt="Logo" className="mt-0" />
        </Link>

        <h1 className="w-58 text-4xl font-bold text-azulEscuro">Redefinir senha</h1>
        <p className="text-roxo text-sm w-80">
          {valid === false
            ? "Link inválido ou expirado. Solicite novamente."
            : "Crie uma nova senha para a sua conta."}
        </p>

        {valid === null && <p className="text-sm text-gray-500">Verificando link...</p>}

        {valid && (
          <>
            <p className="text-roxo text-sm -mb-4">
              Nova senha <span className="text-red-600">*</span>
            </p>
            <input
              type="password"
              placeholder="Digite a nova senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 text-sm border-2 border rounded-2xl placeholder:font-light placeholder-gray-300 placeholder:text-sm placeholder:pl-3 focus:border-roxo focus:ring-roxo focus:outline-none"
              minLength={6}
              required
            />

            <p className="text-roxo text-sm -mb-4 mt-3">
              Confirmar senha <span className="text-red-600">*</span>
            </p>
            <input
              type="password"
              placeholder="Confirme a nova senha"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full p-2 text-sm border-2 border rounded-2xl placeholder:font-light placeholder-gray-300 placeholder:text-sm placeholder:pl-3 focus:border-roxo focus:ring-roxo focus:outline-none"
              minLength={6}
              required
            />
          </>
        )}

        {err && <p className="text-red-600 text-sm mt-1 w-full">{err}</p>}

        {valid && (
          <button
            className="w-full bg-azulEscuro text-white font-light text-sm py-3 border-2 rounded-2xl mt-4 hover:bg-white hover:text-azulEscuro hover:font-medium hover:border-2 hover:border-azulEscuro duration-300 disabled:opacity-50"
            onClick={handleChange}
            disabled={loading}
            type="button"
          >
            {loading ? "Alterando..." : "Mudar senha"}
          </button>
        )}

        {valid === false && (
          <Link to="/Login" className="underline text-roxo hover:text-azulEscuro text-sm mt-2">
            Voltar ao login
          </Link>
        )}
      </div>

      <div className="hidden lg:flex w-1/2 flex-col items-center relative gap-10 rounded-t-2xl bg-gradient-to-r from-roxo via-[#191B40] via-100% to-indigo-500 p-6 md:p-10 border rounded-2xl mt-4 lg:mt-2 lg:mr-2 lg:mb-2">
        <div className="bg-white rounded-b-2xl p-6 shadow-md w-80 -translate-y-10 justify-center opacity-50">
          <p className="text-gray-700 font-bold leading-tight mb-14 -mt-2">
            A tecnologia é melhor quando reúne as pessoas.
          </p>
          <div className="flex items-center gap-4 mt-4">
            <img className="w-10 h-10" src={WordPress} alt="Moço" />
            <div className="flex flex-col">
              <p className="font-bold text-xs mb-0.5">Matt Mullenweg</p>
              <p className="text-xs text-gray-700">criador do WordPress</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg w-80 p-4 z-20">
          <div className="flex justify-between items-center mb-4">
            <button className="w-10 h-10 flex items-center justify-center border rounded-xl border-2 text-gray-500">
              <img src={Perigo} alt="Ícone de Perigo" className="w-5 h-5 mb-0.5" />
            </button>
            <button className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-400 rounded-lg text-sm">
              <img src={Calendário} alt="Ícone de Calendário" className="w-4 h-4 mr-2" />
              <p className="text-xs text-gray-400 mr-2">Último mês</p>
            </button>
          </div>
          <div className="flex items-center gap-2 mt-11 mb-6">
            <p className="text-3xl font-GT font-bold text-cinza mr-2">+ 84.32%</p>
            <span className="bg-green-100 text-green-400 px-6 py-1 rounded-md text-sm">
              <img src={Seta} alt="Setinha para cima" className="w-5 mt-0.5" />
            </span>
          </div>

          <div className="flex h-40">
            <div className="flex flex-col justify-between h-full mr-2 text-gray-400 text-xs">
              <span>100</span><span>80</span><span>60</span><span>40</span><span>20</span><span>0</span>
            </div>
            <div className="flex items-end justify-end h-full">
              <div className="w-12 h-full bg-zinc-100 rounded-lg relative mr-3">
                <div className="absolute bottom-0 w-12 h-8 bg-claro rounded-lg opacity-20"></div>
              </div>
              <div className="w-12 h-full bg-zinc-100 rounded-lg relative mr-3">
                <div className="absolute bottom-0 w-12 h-16 bg-claro rounded-lg opacity-45"></div>
              </div>
              <div className="w-12 h-full bg-zinc-100 rounded-lg relative mr-3">
                <div className="absolute bottom-0 w-12 h-20 bg-claro rounded-lg opacity-75"></div>
              </div>
              <div className="w-12 h-full bg-zinc-100 rounded-lg relative">
                <div className="absolute bottom-0 w-12 h-28 bg-claro rounded-lg"></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-t-2xl shadow-lg w-80 h-32 p-4 z-10 opacity-50 absolute bottom-0">
          <div className="flex justify-between items-center mb-4">
            <button className="w-10 h-10 flex items-center justify-center border rounded-xl border-2 text-gray-500">
              <img src={Container} alt="Ícone de Perigo" className="w-5 h-5 opacity-50" />
            </button>
            <button className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-400 rounded-lg text-sm">
              <img src={Calendário} alt="Ícone de Calendário" className="w-4 h-4 mr-2" />
              <p className="text-xs text-gray-400 mr-2">Último mês</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
