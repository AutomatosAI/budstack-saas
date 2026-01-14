"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MessageSquare, Mail, Phone, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { Navbar, Footer } from "@/components/landing";

const contactSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, { message: "Name is required" })
        .max(100, { message: "Name must be less than 100 characters" }),
    email: z
        .string()
        .trim()
        .email({ message: "Please enter a valid email address" })
        .max(255, { message: "Email must be less than 255 characters" }),
    phone: z
        .string()
        .trim()
        .max(20, { message: "Phone must be less than 20 characters" })
        .optional()
        .or(z.literal("")),
    message: z
        .string()
        .trim()
        .min(1, { message: "Message is required" })
        .max(1000, { message: "Message must be less than 1000 characters" }),
});

type ContactFormValues = z.infer<typeof contactSchema>;

const contactInfo = [
    {
        icon: Mail,
        title: "Email us",
        detail: "hello@popcornmedia.io",
    },
    {
        icon: Phone,
        title: "Call us",
        detail: "+49 (30) 123 4567",
    },
    {
        icon: MapPin,
        title: "Our location",
        detail: "Berlin, Germany",
    },
];

export default function ContactPage() {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<ContactFormValues>({
        resolver: zodResolver(contactSchema),
        defaultValues: {
            name: "",
            email: "",
            phone: "",
            message: "",
        },
    });

    const onSubmit = async (data: ContactFormValues) => {
        setIsSubmitting(true);
        // Simulate form submission
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setIsSubmitting(false);
        toast.success("Message sent successfully!", {
            description: "We'll get back to you as soon as possible.",
        });
        form.reset();
        console.log("Contact form submitted:", data);
    };

    return (
        <div className="min-h-screen bg-background">
            <Navbar />

            <main className="px-4 py-24 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-6xl">
                    {/* Header */}
                    <div className="mb-16 text-center">
                        <div className="mb-4 flex justify-center">
                            <div className="section-badge">
                                <MessageSquare className="h-4 w-4" />
                                Contact
                            </div>
                        </div>
                        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                            Get in touch with Popcorn Media
                        </h1>
                        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                            Questions about setup, integrations or enterprise plans? We are
                            here to help.
                        </p>
                    </div>

                    {/* Content grid */}
                    <div className="grid gap-8 lg:grid-cols-5">
                        {/* Contact form - larger */}
                        <div className="card-floating p-8 lg:col-span-3 lg:p-10">
                            <div className="mb-8 flex items-center gap-4">
                                <div className="icon-badge">
                                    <MessageSquare className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="font-display text-xl font-semibold text-foreground">
                                        Send us a message
                                    </h2>
                                    <p className="text-sm text-muted-foreground">
                                        Let&apos;s hear from you.
                                    </p>
                                </div>
                            </div>

                            <Form {...form}>
                                <form
                                    onSubmit={form.handleSubmit(onSubmit)}
                                    className="space-y-6"
                                >
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                    Name
                                                </FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="Jordan Miller"
                                                        className="h-12 rounded-xl border-[rgba(15,23,42,0.08)] bg-muted/30 px-4 text-foreground placeholder:text-muted-foreground/60 focus:border-accent focus:ring-accent"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                    Email
                                                </FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="email"
                                                        placeholder="jordan@example.com"
                                                        className="h-12 rounded-xl border-[rgba(15,23,42,0.08)] bg-muted/30 px-4 text-foreground placeholder:text-muted-foreground/60 focus:border-accent focus:ring-accent"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="phone"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                    Phone
                                                </FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="tel"
                                                        placeholder="+49 (30) 123 4567"
                                                        className="h-12 rounded-xl border-[rgba(15,23,42,0.08)] bg-muted/30 px-4 text-foreground placeholder:text-muted-foreground/60 focus:border-accent focus:ring-accent"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="message"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                    Message
                                                </FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        placeholder="Your Message"
                                                        rows={4}
                                                        className="rounded-xl border-[rgba(15,23,42,0.08)] bg-muted/30 px-4 py-3 text-foreground placeholder:text-muted-foreground/60 focus:border-accent focus:ring-accent"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <Button
                                        type="submit"
                                        variant="default"
                                        size="lg"
                                        className="w-full"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? "Sending..." : "Submit Form"}
                                    </Button>
                                </form>
                            </Form>
                        </div>

                        {/* Contact info cards - right side */}
                        <div className="flex flex-col gap-6 lg:col-span-2">
                            {contactInfo.map((info) => (
                                <div key={info.title} className="card-floating p-6">
                                    <div className="flex items-center gap-4">
                                        <div className="icon-badge">
                                            <info.icon className="h-5 w-5 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="font-display font-semibold text-foreground">
                                                {info.title}
                                            </h3>
                                            <p className="text-muted-foreground">{info.detail}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Decorative element */}
                            <div className="relative mt-auto hidden lg:block">
                                <div className="absolute -bottom-8 -right-8 opacity-20">
                                    <div className="h-32 w-28 rounded-2xl border-2 border-muted-foreground/30 bg-card shadow-lg">
                                        <div className="flex h-8 items-center justify-center border-b border-muted-foreground/20">
                                            <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                                            <div className="mx-1 h-2 w-2 rounded-full bg-muted-foreground/30" />
                                        </div>
                                        <div className="flex items-center justify-center pt-6">
                                            <span className="font-display text-4xl font-bold text-muted-foreground/40">
                                                7
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute -bottom-16 -right-16 opacity-15">
                                    <div className="h-24 w-20 rounded-2xl border-2 border-muted-foreground/30 bg-card shadow-lg">
                                        <div className="flex h-6 items-center justify-center border-b border-muted-foreground/20">
                                            <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                                            <div className="mx-1 h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                                        </div>
                                        <div className="flex items-center justify-center pt-4">
                                            <span className="font-display text-2xl font-bold text-muted-foreground/40">
                                                4
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
