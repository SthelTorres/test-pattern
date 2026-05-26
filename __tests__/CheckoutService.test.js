import { CheckoutService } from '../src/services/CheckoutService.js';
import { Pedido } from '../src/domain/Pedido.js';
import { Item } from '../src/domain/Item.js';
import { UserMother } from './builders/UserMother.js';
import { CarrinhoBuilder } from './builders/CarrinhoBuilder.js';

describe('CheckoutService', () => {
    const cartaoCredito = { numero: '4111111111111111', cvv: '123' };

    describe('quando o pagamento falha', () => {
        it('deve retornar null sem persistir pedido ou enviar e-mail', async () => {
            // Arrange
            const carrinho = new CarrinhoBuilder().build();

            const gatewayStub = {
                cobrar: jest.fn().mockResolvedValue({ success: false }),
            };

            const repositoryDummy = {
                salvar: jest.fn(),
            };

            const emailDummy = {
                enviarEmail: jest.fn(),
            };

            const checkoutService = new CheckoutService(
                gatewayStub,
                repositoryDummy,
                emailDummy
            );

            // Act
            const pedido = await checkoutService.processarPedido(carrinho, cartaoCredito);

            // Assert (Verificação de Estado)
            expect(pedido).toBeNull();
            expect(repositoryDummy.salvar).not.toHaveBeenCalled();
            expect(emailDummy.enviarEmail).not.toHaveBeenCalled();
        });
    });

    describe('quando um cliente Padrão finaliza a compra', () => {
        it('deve retornar o pedido salvo com totalFinal sem desconto', async () => {
            // Arrange
            const carrinho = new CarrinhoBuilder().build();

            const gatewayStub = {
                cobrar: jest.fn().mockResolvedValue({ success: true }),
            };

            const repositoryStub = {
                salvar: jest.fn().mockImplementation(async (pedido) => {
                    return new Pedido(10, pedido.carrinho, pedido.totalFinal, pedido.status);
                }),
            };

            const emailMock = {
                enviarEmail: jest.fn().mockResolvedValue(undefined),
            };

            const checkoutService = new CheckoutService(
                gatewayStub,
                repositoryStub,
                emailMock
            );

            // Act
            const pedido = await checkoutService.processarPedido(carrinho, cartaoCredito);

            // Assert (Verificação de Estado)
            expect(pedido).not.toBeNull();
            expect(pedido.totalFinal).toBe(100);
            expect(gatewayStub.cobrar).toHaveBeenCalledWith(100, cartaoCredito);
        });
    });

    describe('quando um cliente Premium finaliza a compra', () => {
        it('deve aplicar desconto de 10%, processar pagamento e enviar e-mail de confirmação', async () => {
            // Arrange
            const usuarioPremium = UserMother.umUsuarioPremium();
            const carrinho = new CarrinhoBuilder()
                .comUser(usuarioPremium)
                .comItens([
                    new Item('Notebook', 150),
                    new Item('Mouse', 50),
                ])
                .build();

            const gatewayStub = {
                cobrar: jest.fn().mockResolvedValue({ success: true }),
            };

            const repositoryStub = {
                salvar: jest.fn().mockImplementation(async (pedido) => {
                    return new Pedido(42, pedido.carrinho, pedido.totalFinal, pedido.status);
                }),
            };

            const emailMock = {
                enviarEmail: jest.fn().mockResolvedValue(undefined),
            };

            const checkoutService = new CheckoutService(
                gatewayStub,
                repositoryStub,
                emailMock
            );

            // Act
            const pedido = await checkoutService.processarPedido(carrinho, cartaoCredito);

            // Assert (Verificação de Comportamento)
            expect(gatewayStub.cobrar).toHaveBeenCalledWith(180, cartaoCredito);
            expect(emailMock.enviarEmail).toHaveBeenCalledTimes(1);
            expect(emailMock.enviarEmail).toHaveBeenCalledWith(
                'premium@email.com',
                'Seu Pedido foi Aprovado!',
                'Pedido 42 no valor de R$180'
            );
            expect(pedido).not.toBeNull();
            expect(pedido.totalFinal).toBe(180);
        });
    });
});
