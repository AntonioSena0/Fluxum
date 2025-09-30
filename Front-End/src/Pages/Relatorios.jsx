import { useState } from "react";
import Sidebar2 from "../Components/Sidebar2";
import Pesquisa from "../assets/assetsAlertas/pesquisar.svg";
import Grafico from "../assets/assetsRelatorios/grafico.svg";
import Horario from "../assets/assetsRelatorios/horario.svg";

const Relatorios = () => {
  const [pesquisa, setPesquisa] = useState("");

  const dadosTabela = [
    { id: "PCDO-004-BSZ", local: "São Paulo, SP", status: "Atrasado", data: "08/08/2025" },
    { id: "PCFO-015-COZ", local: "Rio de Janeiro, RJ", status: "Em trânsito", data: "02/08/2025" },
    { id: "KCDO-009-PSZ", local: "Rio de Janeiro, RJ", status: "Em trânsito", data: "01/08/2025" },
    { id: "PCDO-004-BSZ", local: "São Paulo, SP", status: "Atrasado", data: "08/08/2025" },
    { id: "PCDO-004-BSZ", local: "Rio de Janeiro, RJ", status: "Atrasado", data: "08/08/2025" },
    { id: "PCDO-004-BSZ", local: "São Paulo, SP", status: "Atrasado", data: "08/08/2025" },
  ];

  return (
    <div className="min-h-screen w-full bg-deletar flex flex-col md:flex-row relative">
      <Sidebar2 />
      <div className="flex flex-col w-full md:w-[96%] mt-8 mb-8 px-4 md:px-6">

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
          <p className="mr-4 text-xl">
            Oi, <span className="text-[#3E41C0]">Felipe</span>!
          </p>
          <div className="relative flex-1 max-w-full sm:max-w-4xl">
            <input
              type="text"
              placeholder="Pesquisar relatório..."
              value={pesquisa}
              onChange={(e) => setPesquisa(e.target.value)}
              className="w-full h-12 rounded-3xl bg-white pl-16 pr-4 text-sm focus:outline-none"
            />
            <img
              src={Pesquisa}
              alt="Pesquisar"
              className="w-5 h-5 absolute ml-6 top-1/2 -translate-y-1/2 pointer-events-none"
            />
          </div>
        </div>

        <div className="bg-white rounded-3xl flex flex-col px-6 py-6 h-full">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-xl font-bold font-GT text-azulEscuro mb-6">Relatórios</h1>
                <button className="bg-[#ECF2F9] text-azulEscuro font-medium rounded-2xl py-2 px-6 text-[12px] hover:bg-white duration-500">Exportar PDF</button>
                </div>
          <div className="flex justify-center">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-[#F2F6FB] p-6 rounded-[30px] justify-between items-center">
              <p className="text-sm mt-2">Total de cargas movimentadas</p>
              <div className="flex justify-between items-center">
                <p className="text-[38px] font-GT mt-4 text-[#3E41C0]">2.008</p>
                <img
              src={Grafico}
              alt="Gráfico"
              className="mt-4 w-20 h-20 pointer-events-none"
            />
              </div>
            </div>
            <div className="bg-[#F2F6FB] p-6 rounded-[30px] justify-between items-center">
                <p className="text-sm mt-2">Tempo médio de entrega</p>
              <div className="flex justify-between items-center">
              <p className="text-[38px] font-GT text-[#3E41C0]">3,5 dias</p>
                <img
              src={Horario}
              alt="Horario"
              className="w-20 h-20 ml-6 pointer-events-none"
            />
              </div>
            </div>

            <div className="bg-[#F2F6FB] px-8 py-4 rounded-3xl">
    <div className="flex justify-center items-center gap-8 mt-4">
    <p className="font-GT text-azulEscuro">ID</p>
    <p className="font-GT text-azulEscuro">Localização</p>
    <p className="font-GT text-azulEscuro">Status</p>
    <p className="font-GT text-azulEscuro">Data</p>
    </div>
    <div className=""></div>
</div>

<div className="bg-[#F2F6FB] p-6 rounded-xl">
  <p className="text-sm mb-4">Alertas registrados</p>
  <div className="flex items-end gap-4 h-48">
    <div className="w-12 bg-[#9F9CE8] h-40 rounded-xl"></div>
    <div className="w-12 bg-[#9F9CE8] h-24 rounded-xl"></div>
    <div className="w-12 bg-[#9F9CE8] h-36 rounded-xl"></div>
    <div className="w-12 bg-[#9F9CE8] h-28 rounded-xl"></div>
  </div>
  <div className="flex gap-11 ml-3 text-xs mt-2 text-azulEscuro">
    <span>Set</span>
    <span>Out</span>
    <span>Nov</span>
    <span>Dez</span>
  </div>
</div>
</div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Relatorios;
