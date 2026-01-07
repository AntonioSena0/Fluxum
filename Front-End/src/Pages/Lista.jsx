import { useState, useEffect } from "react";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import ListaIcone from "../assets/assetsLista/lista.svg";
import Lixeira from "../assets/assetsLista/lixeira.svg";
import Caneta from "../assets/assetsLista/caneta.svg";
import Sidebar2 from "../Components/Sidebar2";
import { useNavigate } from "react-router-dom";

const Lista = () => {
  const navigate = useNavigate();
  const [dispositivos, setDispositivos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pega o token
  const token = localStorage.getItem("token") || localStorage.getItem("accessToken");

  // --- BUSCAR DADOS DA API ---
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const response = await fetch("http://localhost:3000/api/v1/devices", {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setDispositivos(data);
        } else {
          console.error("Erro ao buscar dispositivos");
        }
      } catch (error) {
        console.error("Erro de conexão:", error);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchDevices();
    } else {
      setLoading(false);
    }
  }, [token]);

  // --- FUNÇÃO PARA DELETAR DISPOSITIVO ---
  const handleDelete = async (id) => {
    if (!window.confirm(`Tem certeza que deseja excluir o dispositivo ${id}?`)) {
        return;
    }

    try {
        // CORREÇÃO AQUI: Adicionado o espaço entre const e encodedId
        const encodedId = encodeURIComponent(id);

        const response = await fetch(`http://localhost:3000/api/v1/devices/${encodedId}`, {
            method: 'DELETE',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });

        if (response.ok) {
            // Sucesso: Remove o dispositivo da lista visualmente
            setDispositivos(currentDispositivos => currentDispositivos.filter(device => device.id !== id));
            alert("Dispositivo excluído com sucesso!");
        } else {
            const errData = await response.json();
            alert(`Erro ao excluir: ${errData.error || response.statusText}`);
        }
    } catch (error) {
        console.error("Erro na requisição de exclusão:", error);
        alert("Erro de conexão ao tentar excluir.");
    }
  };

  // --- FUNÇÃO PARA EDITAR DISPOSITIVO ---
  const handleEdit = (id) => {
    navigate("/FormCad", { state: { deviceIdToEdit: id } });
  };

  return (
    <div className="min-h-screen w-full bg-deletar flex flex-row">
      <Sidebar2 />

      <div className="flex flex-col items-center justify-center w-full px-6">
        
        <h2 className="text-xl font-GT text-azulEscuro mb-6 text-center">
          Lista de Dispositivos
        </h2>

        <div className="bg-white rounded-3xl p-6 w-full max-w-5xl relative shadow-sm">

          <div className="absolute right-6 top-8">
            <Menu>
              <MenuButton className="flex items-center gap-4 px-6 py-4 text-sm font-medium text-azulEscuro">
                <img src={ListaIcone} alt="filtro" className="w-4 h-4" />
                Filtrar
              </MenuButton>
              <MenuItems className="absolute right-0 mt-2 w-40 rounded-xl bg-white shadow-lg ring-1 ring-black/5 focus:outline-none z-10">
                {["A - Z", "Atv. recente", "Ativos", "Inativos"].map((filtro) => (
                  <MenuItem key={filtro}>
                    {({ focus }) => (
                      <button
                        type="button"
                        className={`w-full text-left px-4 py-2 text-sm rounded-xl ${
                          focus ? "bg-[#9F9CE8] text-white" : "text-azulEscuro"
                        }`}
                      >
                        {filtro}
                      </button>
                    )}
                  </MenuItem>
                ))}
              </MenuItems>
            </Menu>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="text-azulEscuro text-sm font-semibold bg-[#EEF3FB] rounded-3xl">
                  <th className="py-3 px-8 text-left rounded-l-3xl">ID</th>
                  <th className="py-3 px-4 text-left">Nome</th>
                  <th className="py-3 px-4 text-left">Localização</th>
                  <th className="py-3 px-4 text-left">Status</th>
                  <th className="py-3 px-4 text-left rounded-r-3xl">Atualização</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" className="text-center py-4">Carregando...</td></tr>
                ) : dispositivos.length === 0 ? (
                   <tr><td colSpan="6" className="text-center py-4">Nenhum dispositivo encontrado.</td></tr>
                ) : (
                  dispositivos.map((d, i) => (
                    <tr
                      key={d.id}
                      className={`text-sm ${i % 2 === 0 ? "bg-[#ECF2F9]" : "bg-white"} rounded-3xl`}
                    >
                      <td className="px-8 py-3 rounded-l-3xl">{d.id}</td>
                      <td className="px-4 py-3">{d.nome}</td>
                      <td className="px-4 py-3">{d.navio}</td>
                      <td
                        className={`px-4 py-3 ${
                          d.status === "Ativo" ? "text-[#3BB61F]" : "text-[#F21D4E]"
                        }`}
                      >
                        {d.status}
                      </td>
                      <td className="px-4 py-3 rounded-r-3xl">{d.atualizado}</td>
                      <td className="px-4 py-3 flex gap-2 bg-white">
                        
                        <button 
                            className="p-2 rounded-xl bg-[#ECF2F9] hover:bg-gray-200 transition" 
                            onClick={() => handleEdit(d.id)} 
                            title="Editar"
                        >
                          <img src={Caneta} alt="editar" className="w-4 h-4" />
                        </button>
                        
                        <button 
                            className="p-2 rounded-xl bg-[#ECF2F9] hover:bg-red-100 transition group" 
                            onClick={() => handleDelete(d.id)} 
                            title="Excluir"
                        >
                          <img src={Lixeira} alt="deletar" className="w-4 h-4 group-hover:opacity-80" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-6 mt-6">
            <button
              type="button" onClick={() => navigate("/dashboard")}
              className="w-full sm:w-36 h-10 rounded-xl font-medium text-[14px] bg-[#ECF2F9] text-[#5B61B3] hover:bg-slate-200 duration-300"
            >
              Voltar
            </button>
            <button
              type="button" onClick={() => navigate("/FormCad")}
              className="w-full sm:w-36 h-10 rounded-xl font-normal bg-violeta text-white text-[14px] hover:bg-roxo duration-300"
            >
              Cadastrar Novo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Lista;