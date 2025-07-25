export enum PaymentMethodEnum {
  MYFATOORA = 'myfatoora',
  KNET = 'knet', // KNET is often handled via gateways like MyFatoora
  VISA = 'visa', // Visa/Mastercard often via gateways
}

export enum PaymentGatewayStatus {
  SUCCESS = 4, // MyFatoorah paid status example
  FAILED = 1, // MyFatoorah failed status example
  PENDING = 0, // Custom pending status
  // Add other relevant statuses as needed per gateway
}
