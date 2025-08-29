import Logo from "../assets/Logo.svg";
import Instagram from "../assets/Logo do instagram.svg";
import Github from "../assets/Logo do GitHub.svg";

const Footer = () => {
  return (
    <div className="w-full bg-white rounded-t-lg flex flex-col shadow-[0px_0_25px_2px_rgba(25,27,64,0.4)]">
      <div className="flex justify-between">
        <img src={Logo} alt="" className="w-2/12 mt-3 ml-3" />

        <div className="flex ">
          <img src={Instagram} className="mt-6 w-8 mr-5" alt="" />
          <img src={Github} className="mt-6 w-8 mr-5 w-" alt="" />
        </div>
      </div>
      <div className="flex w-full bg-ared-700 justify-evenly px-1 mt-4">
        <div className="flex flex-col w-1/3">
          <div className="text-xl font-bold text-indigo-500 mb-4 text-center">
            Navegue
          </div>

          <div className="flex flex-col justify-center items-center text-indigo-700 text-center list-none gap-y-3 text-sm">
            <li>Início</li>
            <li>Dashboard</li>
            <li>Alertas</li>
            <li>Mapa</li>
            <li>Relatórios</li>
          </div>
        </div>

        <div className="flex flex-col w-1/3 text-center">
          <div className="text-xl font-bold text-indigo-500 mb-4 ">
            Tecnologias
          </div>

          <div className="flex flex-col justify-center items-center text-indigo-700 text-center list-none gap-y-3 text-sm">
            <p>Iot</p>
            <p>Painel na nuvem</p>
            <p>RFID</p>
            <p>Segurança de dados</p>
          </div>
        </div>

        <div className="flex flex-col w-1/3 text-center">
          <div className="text-xl font-bold text-indigo-500 mb-4 ">
            Soluções
          </div>

          <div className="flex flex-col text-indigo-700 gap-y-3 items-center justify-center text-center text-sm">
            <p>Monitoramento</p>
            <p>Alertas</p>
            <p>Visualização gráfica</p>
            <p>Dados em nuvem</p>
            <p>Rastreabilidade logística</p>
          </div>
        </div>
      </div>
      <div className="w-10/12 h-18 border-t-2 border-gray-400 mx-auto mt-6 mb-6 items-center justify-center text-center text-gray-400">
        <br></br>© 2025 Fluxum. Todos os direitos reservados.
      </div>
    </div>
  );
};

export default Footer;
