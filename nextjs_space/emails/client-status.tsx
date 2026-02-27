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

interface ClientStatusEmailProps {
    userName: string;
    status: 'approved' | 'rejected';
    tenantName: string;
    rejectionReason?: string;
    logoUrl?: string;
    primaryColor?: string;
}

export const ClientStatusEmail = ({
    userName = 'User',
    status = 'approved',
    tenantName = 'BudStacks',
    rejectionReason,
    logoUrl,
    primaryColor = '#10b981',
}: ClientStatusEmailProps) => {
    const isApproved = status === 'approved';
    const headerColor = isApproved ? '#10b981' : '#ef4444';

    return (
        <Html>
            <Head />
            <Preview>
                {isApproved
                    ? `You've been approved — ${tenantName}`
                    : `Eligibility update — ${tenantName}`}
            </Preview>
            <Tailwind>
                <Body className="bg-white my-auto mx-auto font-sans">
                    <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
                        {logoUrl && (
                            <Section className="mt-[20px]">
                                <Img src={logoUrl} width="40" height="40" alt={tenantName} className="my-0 mx-auto" />
                            </Section>
                        )}
                        <Section
                            className="rounded p-2 text-center my-[20px]"
                            style={{ backgroundColor: headerColor }}
                        >
                            <Text className="text-white text-[16px] font-bold m-0">
                                {isApproved ? '✓ Approved' : '✗ Not Eligible'}
                            </Text>
                        </Section>
                        <Text className="text-black text-[14px] leading-[24px]">
                            Hi {userName},
                        </Text>
                        {isApproved ? (
                            <>
                                <Text className="text-black text-[14px] leading-[24px]">
                                    Your consultation has been reviewed and you have been <strong>approved</strong> for medical cannabis through <strong>{tenantName}</strong>.
                                </Text>
                                <Text className="text-black text-[14px] leading-[24px]">
                                    You can now browse our product catalogue and place your first order.
                                </Text>
                                <Section className="text-center mt-[32px] mb-[32px]">
                                    <Link
                                        className="p-3 px-6 rounded text-white text-[14px] font-semibold no-underline text-center"
                                        style={{ backgroundColor: primaryColor }}
                                        href={`${process.env.NEXT_PUBLIC_APP_URL}/products`}
                                    >
                                        Browse Products
                                    </Link>
                                </Section>
                            </>
                        ) : (
                            <>
                                <Text className="text-black text-[14px] leading-[24px]">
                                    After reviewing your consultation, we're unable to approve your eligibility at this time.
                                </Text>
                                {rejectionReason && (
                                    <Section className="bg-[#fef2f2] border border-solid border-[#fecaca] rounded p-4 my-4">
                                        <Text className="text-[#991b1b] text-[13px] m-0">
                                            <strong>Reason:</strong> {rejectionReason}
                                        </Text>
                                    </Section>
                                )}
                                <Text className="text-black text-[14px] leading-[24px]">
                                    If you have questions or believe this is an error, please reach out to our support team.
                                </Text>
                            </>
                        )}
                        <Text className="text-[#666666] text-[12px] leading-[24px]">
                            Best regards,<br />The {tenantName} Team
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default ClientStatusEmail;
