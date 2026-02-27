import {
    Body,
    Container,
    Head,
    Heading,
    Html,
    Img,
    Link,
    Preview,
    Section,
    Text,
    Tailwind,
} from '@react-email/components';
import React from 'react';

interface KycLinkEmailProps {
    userName: string;
    kycLink: string;
    tenantName: string;
    logoUrl?: string;
    primaryColor?: string;
}

export const KycLinkEmail = ({
    userName = 'User',
    kycLink = 'https://drgreen.io/kyc/verify',
    tenantName = 'BudStacks',
    logoUrl,
    primaryColor = '#10b981',
}: KycLinkEmailProps) => {
    return (
        <Html>
            <Head />
            <Preview>Complete your identity verification for {tenantName}</Preview>
            <Tailwind>
                <Body className="bg-white my-auto mx-auto font-sans">
                    <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
                        {logoUrl && (
                            <Section className="mt-[20px]">
                                <Img src={logoUrl} width="40" height="40" alt={tenantName} className="my-0 mx-auto" />
                            </Section>
                        )}
                        <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
                            Identity Verification Required
                        </Heading>
                        <Text className="text-black text-[14px] leading-[24px]">
                            Hi {userName},
                        </Text>
                        <Text className="text-black text-[14px] leading-[24px]">
                            To continue with your consultation at <strong>{tenantName}</strong>, you need to complete an identity verification (KYC) check.
                        </Text>
                        <Text className="text-black text-[14px] leading-[24px]">
                            This is a quick process that helps us ensure the safety and security of all our patients. Please click the button below to get started.
                        </Text>
                        <Section className="text-center mt-[32px] mb-[32px]">
                            <Link
                                className="p-3 px-6 rounded text-white text-[14px] font-semibold no-underline text-center"
                                style={{ backgroundColor: primaryColor }}
                                href={kycLink}
                            >
                                Verify My Identity
                            </Link>
                        </Section>
                        <Text className="text-[#666666] text-[12px] leading-[24px]">
                            This link will expire after 24 hours. If you did not request this, you can safely ignore this email.
                        </Text>
                        <Text className="text-[#666666] text-[12px] leading-[24px]">
                            Best regards,<br />The {tenantName} Team
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default KycLinkEmail;
