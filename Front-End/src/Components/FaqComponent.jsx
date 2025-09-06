import React, { useState } from "react";

const FaqComponent = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div
      className={`w-10/12 mx-auto my-auto rounded-xl overflow-hidden transition-colors duration-500
        ${isOpen ? "bg-faq" : "bg-white"}
      `}
    >
      {/* Container da Pergunta */}
      <div
        className={`flex w-full h-20 justify-between border-[3.1px] cursor-pointer
          md:text-xl transition-colors duration-500
          ${isOpen ? "rounded-t-xl border-b-0 bg-faq border-faq" : "rounded-xl bg-white border-bor"}
        `}
        onClick={handleToggle}
      >
        <div
          className={`my-auto pl-4 text-[18px] font-bold pl-6 
            ${isOpen ? "text-res" : "text-azulEscuro"}
          `}
        >
          {question}
        </div>

        <div
          className={`my-auto mr-8 text-3xl font-bold transition-all duration-500
            lg:hover:scale-105 lg:hover:text-violeta
            ${isOpen ? "text-res" : "text-azulEscuro"}`}
        >
          {isOpen ? '-' : '+'}
        </div>
      </div>

      {/* Container da Resposta */}
      <div
        className={`w-full text-res transition-all duration-500 ease-in-out md:text-base lg:text-[14px]
          ${isOpen ? "max-h-[500px] opacity-100 p-4 -mt-2 rounded-b-xl" : "max-h-0 opacity-0 p-0"}
        `}
      >
        <p className="my-auto pl-2 pr-2">{answer}</p>
      </div>
    </div>
  );
};

export default FaqComponent;
