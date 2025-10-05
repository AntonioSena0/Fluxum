// backend/services/transferService.js
const { logger } = require('../utils/observability');

// Esta variável guardará o estado da transferência ativa na memória do servidor.
let activeTransfer = {
  isActive: false,
  fromShipId: null,
  toShipId: null,
  startedBy: null,
};

const startTransfer = ({ fromShipId, toShipId, userId }) => {
  if (activeTransfer.isActive) {
    throw new Error("Já existe uma transferência ativa. Finalize a anterior primeiro.");
  }
  activeTransfer = {
    isActive: true,
    fromShipId,
    toShipId,
    startedBy: userId,
    movedContainers: new Set(), // Para rastrear os containers já movidos
  };
  logger.info(activeTransfer, "Modo de Transferência INICIADO.");
  return activeTransfer;
};

const endTransfer = () => {
  if (!activeTransfer.isActive) {
    throw new Error("Nenhuma transferência ativa para finalizar.");
  }
  logger.info(activeTransfer, "Modo de Transferência FINALIZADO.");
  activeTransfer = { isActive: false, fromShipId: null, toShipId: null, startedBy: null };
  return activeTransfer;
};

const getActiveTransfer = () => {
  return activeTransfer;
};

// Futuramente, adicionaremos a lógica de processar um scan aqui.

module.exports = {
  startTransfer,
  endTransfer,
  getActiveTransfer,
};