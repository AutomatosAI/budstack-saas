
import {
    Body,
    Container,
    Head,
    Heading,
    Html,
    Link,
    Preview,
    Text,
    Tailwind,
    Section,
} from '@react-email/components';
import React from 'react';

interface WelcomeEmailProps {
    userName: string;
    tenantName: string;
    loginUrl: string;
    logoUrl?: string;
    primaryColor?: string;
}

export const WelcomeEmail = ({
    userName = 'User',
    tenantName = 'BudStacks',
    loginUrl = 'https://budstacks.io/login',
    logoUrl,
    primaryColor = '#10b981',
}: WelcomeEmailProps) => {
    return (
        <Html>
            <Head />
            <Preview>Welcome to {tenantName}!</Preview>
            <Tailwind>
                <Body className="bg-white my-auto mx-auto font-sans">
                    <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
                        {logoUrl && (
                            <Section className="mt-[20px]">
                                <img src={logoUrl} width="40" height="40" alt={tenantName} className="my-0 mx-auto" />
                            </Section>
                        )}
                        <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
                            Welcome to <strong>{tenantName}</strong>
                        </Heading>
                        <Text className="text-black text-[14px] leading-[24px]">
                            Hello {userName},
                        </Text>
                        <Text className="text-black text-[14px] leading-[24px]">
                            We're excited to have you on board using <strong>{tenantName}</strong>.
                        </Text>
                        <Section className="text-center mt-[32px] mb-[32px]">
                            <Link
                                className="p-3 rounded text-white text-[12px] font-semibold no-underline text-center"
                                style={{ backgroundColor: primaryColor }}
                                href={loginUrl}
                            >
                                Get Started
                            </Link>
                        </Section>
                        <Text className="text-[#666666] text-[12px] leading-[24px]">
                            If you didn't request this email, there's nothing to worry about - you can safely ignore it.
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default WelcomeEmail;
