/** The settings layer's public surface. */
export {
  CRM_CONTRACT,
  CRM_CONTRACT_KEYS,
  crmContractMismatches,
  describeCrmContractMismatches,
} from './crm-contract.js';
export type { CrmContract, CrmContractMismatch } from './crm-contract.js';
export { DISPLAY_CONTRACT, DISPLAY_CONTRACT_KEYS, displayLocale } from './display-contract.js';
export type { DisplayContract } from './display-contract.js';
export { SHEET_CONTRACT, SHEET_CONTRACT_KEYS } from './sheet-contract.js';
export type { SheetContract } from './sheet-contract.js';
export {
  ORDER_CONTRACT,
  ORDER_CONTRACT_KEYS,
  orderContractMismatches,
  describeOrderContractMismatches,
} from './order-contract.js';
export type { OrderContract, OrderContractMismatch } from './order-contract.js';
