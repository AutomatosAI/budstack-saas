'use client';

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { format } from "date-fns";



const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const headerVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number],
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 60, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number],
    },
  },
};

interface NewsProps {
  posts?: any[];
  tenantSlug?: string;
}

const News = ({ posts, tenantSlug }: NewsProps) => {
  if (!posts || posts.length === 0) return null;

  return (
    <motion.section
      id="news"
      className="bg-background py-12 sm:py-16 md:py-20"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={containerVariants}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 sm:mb-12"
          variants={headerVariants}
        >
          <div>
            <h2 className="font-pharma text-3xl sm:text-4xl md:text-5xl font-semibold text-foreground tracking-tight">
              The Wire
            </h2>
            <p className="font-geist text-muted-foreground mt-2">
              Inside news & updates
            </p>
          </div>
          <Link href={`/store/${tenantSlug}/the-wire`}>
            <Button
              variant="outline"
              size="lg"
              className="font-body rounded-full text-sm sm:text-base"
            >
              View all updates
            </Button>
          </Link>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {posts.map((item) => (
            <motion.div
              key={item.id}
              variants={cardVariants}
              whileHover={{ y: -12, transition: { duration: 0.3, ease: "easeOut" } }}
            >
              <Link href={`/store/${tenantSlug}/the-wire/${item.slug}`}>
                <Card className="group overflow-hidden hover:shadow-xl transition-all duration-300 border-border/50 rounded-2xl cursor-pointer h-full flex flex-col">
                  <div className="relative h-56 overflow-hidden bg-slate-100">
                    {item.coverImage ? (
                      <motion.img
                        src={item.coverImage}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        whileHover={{ scale: 1.1 }}
                        transition={{ duration: 0.5 }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        No Image
                      </div>
                    )}
                  </div>
                  <div className="p-6 flex flex-col flex-grow">
                    <h3 className="font-geist text-lg font-semibold text-foreground mb-2 leading-tight group-hover:text-primary transition-colors tracking-tight line-clamp-2">
                      {item.title}
                    </h3>
                    <p className="font-geist text-muted-foreground text-sm line-clamp-3 leading-relaxed flex-grow">
                      {item.excerpt || item.title}
                    </p>
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
                      <span className="text-xs text-muted-foreground font-geist">
                        {format(new Date(item.createdAt), 'MMM d, yyyy')}
                      </span>
                      <Button
                        variant="link"
                        className="p-0 text-primary font-semibold text-sm"
                      >
                        Read More →
                      </Button>
                    </div>
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
};

export default News;
