
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

interface TenantWelcomeEmailProps {
    adminName: string;
    tenantName: string;
    subdomain: string;
    customDomain?: string | null;
    loginUrl: string;
}

export const TenantWelcomeEmail = ({
    adminName = 'Admin',
    tenantName = 'My Store',
    subdomain = 'mystore',
    customDomain,
    loginUrl = 'https://budstacks.io/login',
}: TenantWelcomeEmailProps) => {
    const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'budstacks.io';
    const storeUrl = customDomain
        ? `https://${customDomain}`
        : `https://${subdomain}.${baseDomain}`;
    const dashboardUrl = `${storeUrl}/tenant-admin`;

    return (
        <Html>
            <Head />
            <Preview>Welcome to BudStacks!</Preview>
            <Tailwind>
                <Body className="bg-white my-auto mx-auto font-sans">
                    <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
                        <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
                            🎉 Welcome to BudStacks!
                        </Heading>
                        <Text className="text-black text-[14px] leading-[24px]">
                            Hi {adminName},
                        </Text>
                        <Text className="text-black text-[14px] leading-[24px]">
                            Congratulations! Your store <strong>{tenantName}</strong> is now live on BudStacks.
                        </Text>

                        <Section className="mt-4 mb-4 border-l-4 border-purple-500 bg-gray-50 p-4 rounded">
                            <Text className="m-0 font-bold">Your Store Details:</Text>
                            <Text className="m-0 text-sm">Store Name: {tenantName}</Text>
                            <Text className="m-0 text-sm">Store URL: <Link href={storeUrl}>{storeUrl}</Link></Text>
                            <Text className="m-0 text-sm">Admin Dashboard: <Link href={dashboardUrl}>{dashboardUrl}</Link></Text>
                        </Section>

                        <Text className="text-black text-[14px] leading-[24px]">
                            <strong>Next Steps:</strong>
                        </Text>
                        <ul className="text-[14px] leading-[24px]">
                            <li>Customize your store's branding and colors</li>
                            <li>Add your products and pricing</li>
                            <li>Set up your custom domain (optional)</li>
                            <li>Configure your store settings</li>
                        </ul>

                        <Section className="text-center mt-[32px] mb-[32px]">
                            <Link
                                className="p-3 rounded text-white text-[12px] font-semibold no-underline text-center bg-purple-600"
                                href={dashboardUrl}
                            >
                                Go to Dashboard
                            </Link>
                        </Section>
                        <Text className="text-[#666666] text-[12px] leading-[24px]">
                            Best regards,<br />The BudStacks Team
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default TenantWelcomeEmail;
