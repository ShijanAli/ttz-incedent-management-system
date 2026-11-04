import {
    ShieldCheck,
    LockKeyhole,
    Database,
    Eye,
    Share2,
    UserRoundCheck,
    RefreshCw,
    Mail,
    ChevronRight,
    FileText,
} from "lucide-react";

const sections = [
    {
        id: "information",
        title: "Information We Collect",
        icon: Database,
        description:
            "We collect information necessary to provide, maintain, and improve our Incident Management System.",
        points: [
            "Personal information such as your name, email address, and contact details.",
            "Account information, including login credentials and user roles.",
            "Incident reports, descriptions, attachments, and related documentation.",
            "System usage data, activity logs, and audit trail information.",
            "Cookies and similar technologies used to enhance your experience.",
        ],
    },
    {
        id: "usage",
        title: "How We Use Your Information",
        icon: Eye,
        description:
            "Your information helps us operate the platform securely and efficiently.",
        points: [
            "To create, manage, assign, and track incidents.",
            "To provide access based on assigned roles and permissions.",
            "To send incident notifications, updates, and system alerts.",
            "To monitor system performance and improve our services.",
            "To maintain audit logs and support security investigations.",
            "To comply with applicable legal and regulatory requirements.",
        ],
    },
    {
        id: "security",
        title: "How We Protect Your Information",
        icon: LockKeyhole,
        description:
            "We implement appropriate technical and organizational measures to protect your information.",
        points: [
            "Role-based access control and permission management.",
            "Secure authentication and access restrictions.",
            "Protection against unauthorized access and data disclosure.",
            "Monitoring and logging of important system activities.",
        ],
    },
    {
        id: "sharing",
        title: "Sharing Your Information",
        icon: Share2,
        description:
            "We do not sell your personal information. Information may be shared only when necessary.",
        points: [
            "With authorized team members who need access to manage incidents.",
            "With trusted service providers supporting our platform.",
            "When required by applicable laws or legal processes.",
            "With your organization according to its access and data policies.",
        ],
    },
    {
        id: "rights",
        title: "Your Privacy Rights",
        icon: UserRoundCheck,
        description:
            "Depending on applicable laws and your organization's policies, you may have the right to:",
        points: [
            "Access your personal information.",
            "Request correction of inaccurate information.",
            "Request deletion of eligible personal information.",
            "Request restrictions on certain data processing activities.",
            "Contact us with questions or concerns about your privacy.",
        ],
    },
    {
        id: "changes",
        title: "Changes to This Privacy Policy",
        icon: RefreshCw,
        description:
            "We may update this Privacy Policy from time to time to reflect changes in our services, security practices, or legal obligations.",
        points: [
            "Updated policies will be published on this page.",
            "The latest revision date will be displayed at the top.",
            "We encourage you to review this page periodically.",
        ],
    },
];

export default function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-slate-50">
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="relative px-6 py-10 sm:px-10 sm:py-12">
                        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-blue-50 blur-3xl" />

                        <div className="relative">
                            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                                <ShieldCheck size={30} strokeWidth={1.8} />
                            </div>

                            <div className="mb-3 flex items-center gap-2">
                                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                    LEGAL & COMPLIANCE
                                </span>
                            </div>

                            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                                Privacy Policy
                            </h1>

                            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base">
                                Your privacy matters to us. Learn how we collect, use, protect,
                                and manage your information while using our Incident Management
                                System.
                            </p>

                            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                                <div className="flex items-center gap-2">
                                    <FileText size={16} />
                                    <span>Last updated: November 4, 2026</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Layout */}
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
                    {/* Sidebar */}
                    <aside className="h-fit lg:sticky lg:top-6">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                                On this page
                            </p>

                            <nav className="space-y-1">
                                {sections.map((section, index) => {
                                    const Icon = section.icon;

                                    return (
                                        <a
                                            key={section.id}
                                            href={`#${section.id}`}
                                            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"
                                        >
                                            <Icon
                                                size={17}
                                                className="shrink-0 text-slate-400 transition group-hover:text-blue-600"
                                            />

                                            <span className="flex-1">{section.title}</span>

                                            <ChevronRight
                                                size={15}
                                                className="text-slate-300 transition group-hover:text-blue-500"
                                            />
                                        </a>
                                    );
                                })}
                            </nav>

                            <div className="mt-5 rounded-xl bg-slate-50 p-4">
                                <div className="mb-2 flex items-center gap-2 text-slate-700">
                                    <ShieldCheck size={17} className="text-blue-600" />
                                    <span className="text-sm font-semibold">
                                        Your data is protected
                                    </span>
                                </div>

                                <p className="text-xs leading-5 text-slate-500">
                                    We are committed to maintaining the confidentiality and
                                    security of your information.
                                </p>
                            </div>
                        </div>
                    </aside>

                    {/* Main Content */}
                    <main className="min-w-0 space-y-6">
                        {/* Introduction */}
                        <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
                            <h2 className="text-lg font-semibold text-slate-900">
                                Introduction
                            </h2>

                            <p className="mt-3 text-sm leading-7 text-slate-600">
                                This Privacy Policy describes how we collect, use, disclose,
                                and protect your personal information when you access or use
                                our Incident Management System. By using our services, you
                                acknowledge that you have read and understood this policy.
                            </p>
                        </section>

                        {/* Privacy Sections */}
                        {sections.map((section, index) => {
                            const Icon = section.icon;

                            return (
                                <section
                                    key={section.id}
                                    id={section.id}
                                    className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-slate-300 sm:p-8"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                                            <Icon size={21} strokeWidth={1.8} />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="mb-2 flex items-center gap-2">
                                                <span className="text-xs font-medium text-slate-400">
                                                    {String(index + 1).padStart(2, "0")}
                                                </span>

                                                <h2 className="text-lg font-semibold text-slate-900">
                                                    {section.title}
                                                </h2>
                                            </div>

                                            <p className="text-sm leading-7 text-slate-600">
                                                {section.description}
                                            </p>

                                            <ul className="mt-4 space-y-3">
                                                {section.points.map((point, pointIndex) => (
                                                    <li
                                                        key={pointIndex}
                                                        className="flex items-start gap-3 text-sm leading-6 text-slate-600"
                                                    >
                                                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />

                                                        <span>{point}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </section>
                            );
                        })}

                        {/* Contact */}
                        <section
                            id="contact"
                            className="scroll-mt-24 overflow-hidden rounded-2xl bg-slate-900 p-6 sm:p-8"
                        >
                            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-blue-300">
                                        <Mail size={22} />
                                    </div>

                                    <h2 className="text-xl font-semibold text-white">
                                        Have questions about your privacy?
                                    </h2>

                                    <p className="mt-2 max-w-lg text-sm leading-6 text-slate-400">
                                        If you have any questions, concerns, or requests regarding
                                        this Privacy Policy, please contact our privacy team.
                                    </p>
                                </div>

                                <a
                                    href="mailto:privacy@example.com"
                                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
                                >
                                    <Mail size={16} />
                                    Contact Us
                                </a>
                            </div>
                        </section>

                        {/* Footer */}
                        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 py-6 text-xs text-slate-400 sm:flex-row">
                            <p>
                                © {new Date().getFullYear()} Incident Management System.
                                All rights reserved.
                            </p>

                            <p className="flex items-center gap-2">
                                <ShieldCheck size={14} />
                                Privacy & Security
                            </p>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}
