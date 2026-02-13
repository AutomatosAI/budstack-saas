
import {
    Body,
    Container,
    Column,
    Head,
    Heading,
    Html,
    Img,
    Link,
    Preview,
    Row,
    Section,
    Text,
    Tailwind,
} from '@react-email/components';
import React from 'react';

interface OrderItem {
    id: string;
    name: string;
    quantity: number;
    price: number;
}

interface OrderConfirmationEmailProps {
    userName: string;
    orderNumber: string;
    items: OrderItem[];
    total: number;
    shippingAddress: string;
    tenantName: string;
    logoUrl?: string;
    primaryColor?: string;
}

export const OrderConfirmationEmail = ({
    userName = 'User',
    orderNumber = 'Order-1234',
    items = [
        { id: '1', name: 'Product A', quantity: 2, price: 50 },
        { id: '2', name: 'Product B', quantity: 1, price: 30 }
    ],
    total = 130,
    shippingAddress = '123 Main St, Anytown, AT',
    tenantName = 'BudStacks',
    logoUrl,
    primaryColor = '#10b981',
}: OrderConfirmationEmailProps) => {
    return (
        <Html>
            <Head />
            <Preview>Order Confirmation #{orderNumber}</Preview>
            <Tailwind>
                <Body className="bg-white my-auto mx-auto font-sans">
                    <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
                        {logoUrl && (
                            <Section className="mt-[20px]">
                                <Img src={logoUrl} width="40" height="40" alt={tenantName} className="my-0 mx-auto" />
                            </Section>
                        )}
                        <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
                            Order Confirmed!
                        </Heading>
                        <Text className="text-black text-[14px] leading-[24px]">
                            Hi {userName},
                        </Text>
                        <Text className="text-black text-[14px] leading-[24px]">
                            Your order <strong>#{orderNumber}</strong> has been successfully placed.
                        </Text>

                        <Section className="mt-4 mb-4 border border-solid border-[#eaeaea] rounded p-4">
                            <Text className="text-lg font-bold m-0 mb-2">Order Details</Text>
                            {items.map((item) => (
                                <Row key={item.id} className="mb-2">
                                    <Column className="w-8/12">
                                        <Text className="m-0 text-sm">{item.quantity}x {item.name}</Text>
                                    </Column>
                                    <Column className="text-right">
                                        <Text className="m-0 text-sm">€{(item.price * item.quantity).toFixed(2)}</Text>
                                    </Column>
                                </Row>
                            ))}
                            <div className="border-t border-[#eaeaea] my-2 pt-2 flex justify-between">
                                <Text className="m-0 font-bold">Total</Text>
                                <Text className="m-0 font-bold float-right">€{total.toFixed(2)}</Text>
                            </div>
                        </Section>

                        <Text className="text-black text-[14px] leading-[24px]">
                            <strong>Shipping Address:</strong><br />
                            {shippingAddress}
                        </Text>

                        <Section className="text-center mt-[32px] mb-[32px]">
                            <Link
                                className="p-3 rounded text-white text-[12px] font-semibold no-underline text-center"
                                style={{ backgroundColor: primaryColor }}
                                href={`https://${tenantName.toLowerCase()}.budstacks.io/orders/${orderNumber}`}
                            >
                                Track Order
                            </Link>
                        </Section>
                        <Text className="text-[#666666] text-[12px] leading-[24px]">
                            Best regards,<br />The {tenantName} Team
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default OrderConfirmationEmail;
