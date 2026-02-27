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

interface KycStatusEmailProps {
    userName: string;
    status: 'approved' | 'rejected';
    tenantName: string;
    rejectionReason?: string;
    kycLink?: string;
    logoUrl?: string;
    primaryColor?: string;
}

export const KycStatusEmail = ({
    userName = 'User',
    status = 'approved',
    tenantName = 'BudStacks',
    rejectionReason,
    kycLink,
    logoUrl,
    primaryColor = '#10b981',
}: KycStatusEmailProps) => {
    const isApproved = status === 'approved';
    const headerColor = isApproved ? '#10b981' : '#ef4444';

    return (
        <Html>
            <Head />
            <Preview>
                {isApproved
                    ? `Your identity verification has been approved — ${tenantName}`
                    : `Identity verification update — ${tenantName}`}
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
                                {isApproved ? '✓ KYC Verified' : '✗ KYC Verification Failed'}
                            </Text>
                        </Section>
                        <Text className="text-black text-[14px] leading-[24px]">
                            Hi {userName},
                        </Text>
                        {isApproved ? (
                            <>
                                <Text className="text-black text-[14px] leading-[24px]">
                                    Your identity verification has been <strong>approved</strong>. You can now proceed with your consultation and place orders through <strong>{tenantName}</strong>.
                                </Text>
                            </>
                        ) : (
                            <>
                                <Text className="text-black text-[14px] leading-[24px]">
                                    Unfortunately, your identity verification was <strong>not approved</strong>.
                                </Text>
                                {rejectionReason && (
                                    <Section className="bg-[#fef2f2] border border-solid border-[#fecaca] rounded p-4 my-4">
                                        <Text className="text-[#991b1b] text-[13px] m-0">
                                            <strong>Reason:</strong> {rejectionReason}
                                        </Text>
                                    </Section>
                                )}
                                {kycLink && (
                                    <Section className="text-center mt-[24px] mb-[24px]">
                                        <Link
                                            className="p-3 px-6 rounded text-white text-[14px] font-semibold no-underline text-center"
                                            style={{ backgroundColor: primaryColor }}
                                            href={kycLink}
                                        >
                                            Try Again
                                        </Link>
                                    </Section>
                                )}
                                <Text className="text-black text-[14px] leading-[24px]">
                                    If you believe this is an error, please contact our support team.
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

export default KycStatusEmail;
