import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import React from "react";

interface TeamInviteEmailProps {
  tenantName: string;
  inviterName?: string | null;
  role: string;
  acceptUrl: string;
  logoUrl?: string | null;
  primaryColor?: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  editor: "Editor",
  customer_support: "Customer Support",
  web_designer: "Web Designer",
  manager: "Manager",
};

export const TeamInviteEmail = ({
  tenantName = "BudStacks",
  inviterName,
  role = "editor",
  acceptUrl = "https://budstacks.io/accept-invite",
  logoUrl,
  primaryColor = "#10b981",
}: TeamInviteEmailProps) => {
  const roleLabel = ROLE_LABELS[role] ?? role;
  return (
    <Html>
      <Head />
      <Preview>{`${tenantName} invited you to join their team on BudStacks`}</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
            {logoUrl && (
              <Section className="mt-[20px]">
                <img
                  src={logoUrl}
                  width="40"
                  height="40"
                  alt={tenantName}
                  className="my-0 mx-auto"
                />
              </Section>
            )}
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
              Join the {tenantName} team
            </Heading>
            <Text className="text-black text-[14px] leading-[24px]">
              {inviterName ? `${inviterName} has` : `${tenantName} has`} invited you to join{" "}
              <strong>{tenantName}</strong> on BudStacks as a <strong>{roleLabel}</strong>.
            </Text>
            <Text className="text-black text-[14px] leading-[24px]">
              Click below to accept the invitation and set up your account.
            </Text>
            <Section className="text-center mt-[32px] mb-[32px]">
              <Link
                className="p-3 rounded text-white text-[12px] font-semibold no-underline text-center"
                style={{ backgroundColor: primaryColor }}
                href={acceptUrl}
              >
                Accept invitation
              </Link>
            </Section>
            <Text className="text-[#666666] text-[12px] leading-[20px]">
              This invitation expires in 7 days. If you weren&apos;t expecting it, you can safely
              ignore this email.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default TeamInviteEmail;
