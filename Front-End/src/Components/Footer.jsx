import Logo from "../assets/Logo.svg";

import Icon from "@mdi/react";
import { mdiInstagram, mdiGithub } from "@mdi/js";

const Footer = () => {
  return (
    <div className="w-full bg-white rounded-[55px] pt-12 flex flex-col shadow-[0px_-6px_80px_rgba(0,0,0,0.1)] xl:mt-28">
      <div className="w-10/12 mx-auto border-2 border-[#A1A1A1]/50 rounded-[45px] p-6 mb-32 shadow-[0px_40px_80px_0px_rgba(0,0,0,0.1)]">
        <div className=" xl:flex xl:justify-start xl:gap-x-24">
          <div className="flex justify-between xl:flex-col xl:justify-normal xl:w-2/4">
            <img
              src={Logo}
              alt="Logo Fluxum"
              className="w-1/2 sm:w-6 mt-3 md:w-24 xl:h-16 ml-6"
            />
            <div className="hidden xl:flex flex-col ml-14">
              <div className="w-1/2 mt-4 text-gray-400 text-sm">
                Fluxum - Dashboard Inteligente com Computação em Nuvem Para Contâineres - Transformando o fluxo portuário com dados e inteligência.
              </div>
              <div className="hidden xl:flex">
                <Icon
                  path={mdiInstagram}
                  className="mt-6 text-faq hover:text-violeta transition-all duration-700 hover:cursor-pointer"
                  size={1.8}
                />
                <Icon
                  path={mdiGithub}
                  className="ml-4 mt-6 text-faq hover:text-violeta transition-all duration-700 hover:cursor-pointer"
                  size={1.8}
                />
              </div>
            </div>
            <div className="flex xl:hidden">
              <Icon
                path={mdiInstagram}
                className="mt-8 mr-5 text-faq hover:text-violeta transition-all duration-700 hover:cursor-pointer"
                size={1.7}
              />
              <Icon
                path={mdiGithub}
                className="mt-8 mr-5 text-faq hover:text-violeta transition-all duration-700 hover:cursor-pointer"
                size={1.7}
              />
            </div>
          </div>

          <div className="flex justify-start px-1 mt-4 gap-x-16 xl:mt-4">
            <div className="flex flex-col">
              <div className="text-base font-bold text-roxo mb-4 text-left xl:text-[18px]">
                Navegue
              </div>
              <div className="flex flex-col justify-center items-start text-azulEscuro list-none gap-y-4 text-base xl:text-[14px]">
                <p className="hover:text-violeta transition-all duration-500 hover:cursor-default underline">Início</p>
                <p className="hover:text-violeta transition-all duration-500 hover:cursor-pointer">Dashboard</p>
                <p className="hover:text-violeta transition-all duration-500 hover:cursor-pointer">Alertas</p>
                <p className="hover:text-violeta transition-all duration-500 hover:cursor-pointer">Mapa</p>
                <p className="hover:text-violeta transition-all duration-500 hover:cursor-pointer">Relatórios</p>
              </div>
            </div>

            <div className="flex flex-col text-left">
              <div className="text-base font-bold text-roxo mb-4 xl:text-[18px]">
                Tecnologias
              </div>
              <div className="flex flex-col justify-center items-start text-azulEscuro list-none gap-y-4 text-base xl:text-[14px]">
                <p className="hover:text-violeta transition-all duration-500 hover:cursor-default">Iot</p>
                <p className="hover:text-violeta transition-all duration-500 hover:cursor-default">Painel na nuvem</p>
                <p className="hover:text-violeta transition-all duration-500 hover:cursor-default">RFID</p>
                <p className="hover:text-violeta transition-all duration-500 hover:cursor-default">Segurança de dados</p>
              </div>
            </div>

            <div className="flex flex-col text-left">
              <div className="text-base font-bold text-roxo mb-4 xl:text-[18px]">
                Soluções
              </div>
              <div className="flex flex-col text-azulEscuro gap-y-4 items-start justify-center text-sm xl:text-[14px]">
                <p className="hover:text-violeta transition-all duration-500 hover:cursor-default">Monitoramento</p>
                <p className="hover:text-violeta transition-all duration-500 hover:cursor-default">Alertas</p>
                <p className="hover:text-violeta transition-all duration-500 hover:cursor-default">Visualização gráfica</p>
                <p className="hover:text-violeta transition-all duration-500 hover:cursor-default">Dados em nuvem</p>
                <p className="hover:text-violeta transition-all duration-500 hover:cursor-default">Rastreabilidade logística</p>
              </div>
            </div>
          </div>
        </div>
      <div className="w-11/12 mx-auto mt-10 py-6 border-t-2 border-gray-200">
      </div>
        <p className="text-left text-gray-400 text-sm ml-14 mb-6">
          © 2025 Fluxum. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
};

export default Footer;