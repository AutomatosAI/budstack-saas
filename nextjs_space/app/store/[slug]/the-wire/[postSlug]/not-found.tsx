import Link from 'next/link';

export default function ArticleNotFound() {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="container mx-auto px-4 text-center">
                <h1 className="text-4xl font-bold mb-4">Article Not Found</h1>
                <p className="text-muted-foreground mb-8">
                    The article you're looking for doesn't exist or has been removed.
                </p>
                <Link
                    href="../"
                    className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors"
                >
                    Back to The Wire
                </Link>
            </div>
        </div>
    );
}
