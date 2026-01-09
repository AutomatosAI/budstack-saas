import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

// Use environment variables directly to ensure connection
const prisma = new PrismaClient();

const conditionsData = [
    {
        slug: "anxiety",
        name: "Anxiety Disorders",
        category: "Mental Health",
        categoryKey: "mentalHealth",
        image: "/condition-anxiety.jpg",
        description: "Understanding anxiety disorders, their causes, symptoms, and how medical cannabis can help manage anxiety naturally.",
        causes: [
            { title: "Genetic Factors", desc: "Family history and genetic predisposition can play a significant role in developing anxiety disorders." },
            { title: "Environmental Stress", desc: "Traumatic events, chronic stress, or major life changes can trigger or worsen anxiety symptoms." },
            { title: "Brain Chemistry", desc: "Imbalances in neurotransmitters like serotonin and dopamine can contribute to anxiety disorders." },
            { title: "Medical Conditions", desc: "Certain health conditions, medications, or substance use can cause or exacerbate anxiety symptoms." }
        ],
        symptoms: {
            physical: [
                "Rapid heartbeat and palpitations",
                "Shortness of breath or hyperventilation",
                "Sweating and trembling",
                "Muscle tension and aches",
                "Fatigue and weakness",
                "Difficulty sleeping",
                "Digestive issues"
            ],
            psychological: [
                "Excessive worry and fear",
                "Feeling of impending doom",
                "Difficulty concentrating",
                "Irritability and restlessness",
                "Panic attacks",
                "Avoidance behaviors",
                "Racing thoughts"
            ]
        },
        types: [
            { type: "Generalized Anxiety Disorder (GAD)", desc: "Persistent and excessive worry about various aspects of daily life, lasting at least six months." },
            { type: "Panic Disorder", desc: "Recurring panic attacks and fear of future panic attacks, often with physical symptoms like chest pain and dizziness." },
            { type: "Social Anxiety Disorder", desc: "Intense fear of social situations and being judged or embarrassed in public settings." },
            { type: "Specific Phobias", desc: "Extreme fear of specific objects or situations, such as heights, flying, or animals." }
        ],
        treatments: [
            { title: "Cognitive Behavioral Therapy (CBT)", desc: "Evidence-based therapy that helps identify and change negative thought patterns and behaviors." },
            { title: "Medication", desc: "SSRIs, SNRIs, and benzodiazepines may be prescribed to manage anxiety symptoms." },
            { title: "Mindfulness & Relaxation", desc: "Meditation, yoga, and breathing exercises can help reduce anxiety and promote relaxation." },
            { title: "Lifestyle Modifications", desc: "Regular exercise, healthy diet, adequate sleep, and stress management techniques." }
        ],
        medicalCannabis: {
            content1: "Medical cannabis, particularly CBD-rich strains, has shown promise in managing anxiety symptoms for some patients. CBD interacts with the endocannabinoid system to help regulate mood and stress responses without the psychoactive effects associated with THC.",
            content2: "Research suggests that medical cannabis may help reduce anxiety symptoms by modulating serotonin levels and promoting relaxation. However, it's important to work with healthcare professionals to find the right strain, dosage, and delivery method for your individual needs."
        },
        faqs: [
            { question: "Can medical cannabis help with anxiety?", answer: "Yes, many patients report relief from anxiety symptoms using medical cannabis, particularly CBD-rich products. However, individual responses vary, and it's important to consult with a healthcare professional." },
            { question: "What's the difference between CBD and THC for anxiety?", answer: "CBD is non-psychoactive and may help reduce anxiety without causing a 'high'. THC can have varying effects - low doses may reduce anxiety, while high doses might increase it in some individuals." },
            { question: "Are there any side effects?", answer: "Common side effects may include drowsiness, dry mouth, and changes in appetite. It's important to start with low doses and adjust gradually under medical supervision." },
            { question: "How long does it take to see results?", answer: "Effects can vary based on the delivery method. Inhalation provides faster relief (minutes), while edibles and oils may take 1-2 hours but offer longer-lasting effects." }
        ]
    },
    {
        slug: "chronic-pain",
        name: "Chronic Pain",
        category: "Pain Management",
        categoryKey: "painManagement",
        image: "/condition-chronic-pain.jpg",
        description: "Managing chronic pain with medical cannabis. Learn about causes, symptoms, and evidence-based treatment approaches.",
        causes: [
            { title: "Injury or Trauma", desc: "Previous injuries, accidents, or surgeries can lead to persistent pain even after healing." },
            { title: "Inflammatory Conditions", desc: "Conditions like arthritis, fibromyalgia, and autoimmune disorders cause ongoing inflammation and pain." },
            { title: "Nerve Damage", desc: "Neuropathic pain from nerve injury, diabetes, or other conditions affecting the nervous system." },
            { title: "Degenerative Diseases", desc: "Progressive conditions like osteoarthritis and degenerative disc disease cause chronic pain over time." }
        ],
        symptoms: {
            physical: [
                "Persistent aching or burning pain",
                "Stiffness and reduced mobility",
                "Fatigue and low energy",
                "Sleep disturbances",
                "Muscle tension",
                "Limited range of motion",
                "Inflammation and swelling"
            ],
            psychological: [
                "Depression and mood changes",
                "Anxiety and stress",
                "Difficulty concentrating",
                "Irritability",
                "Social withdrawal",
                "Reduced quality of life"
            ]
        },
        treatments: [
            { title: "Pain Medications", desc: "NSAIDs, opioids, and other pain relievers may be prescribed, though long-term use has risks." },
            { title: "Physical Therapy", desc: "Exercises, stretching, and manual therapy to improve strength, flexibility, and function." },
            { title: "Interventional Procedures", desc: "Nerve blocks, injections, or other minimally invasive procedures to target pain sources." },
            { title: "Complementary Therapies", desc: "Acupuncture, massage, chiropractic care, and other alternative treatments." }
        ],
        medicalCannabis: {
            content1: "Medical cannabis has emerged as a potential alternative for chronic pain management, with research showing it may help reduce pain, inflammation, and improve quality of life. Both CBD and THC can play roles in pain relief through different mechanisms.",
            content2: "Many chronic pain patients report reduced need for opioid medications when using medical cannabis. The anti-inflammatory and analgesic properties of cannabinoids can provide relief while potentially reducing the risk of dependence associated with traditional pain medications."
        },
        faqs: [
            { question: "Is medical cannabis effective for chronic pain?", answer: "Studies and patient reports suggest medical cannabis can be effective for various types of chronic pain, including neuropathic pain, inflammatory pain, and pain from conditions like arthritis and fibromyalgia." },
            { question: "Can I replace my pain medications with cannabis?", answer: "Never stop or change medications without consulting your healthcare provider. Some patients may reduce reliance on other pain medications under medical supervision." },
            { question: "What's the best way to use cannabis for pain?", answer: "The optimal method varies by individual. Options include oils, capsules, inhalation, and topicals. Your healthcare provider can help determine the best approach." },
            { question: "Will medical cannabis make me high?", answer: "This depends on the product. CBD-dominant products provide pain relief without significant psychoactive effects. Balanced or THC-dominant products may have psychoactive effects but can be managed with proper dosing." }
        ]
    },
    {
        slug: "arthritis",
        name: "Arthritis",
        category: "Pain Management",
        categoryKey: "painManagement",
        image: "/condition-arthritis.jpg",
        description: "Understanding arthritis and how medical cannabis can help manage joint pain and inflammation.",
        causes: [
            { title: "Age-Related Wear", desc: "Cartilage naturally breaks down over time, leading to osteoarthritis." },
            { title: "Autoimmune Response", desc: "Rheumatoid arthritis occurs when the immune system attacks joint tissues." },
            { title: "Genetics", desc: "Family history increases risk of developing various forms of arthritis." },
            { title: "Previous Injuries", desc: "Joint injuries can increase risk of developing arthritis in affected areas." }
        ],
        symptoms: {
            physical: [
                "Joint pain and stiffness",
                "Swelling and inflammation",
                "Reduced range of motion",
                "Joint tenderness",
                "Morning stiffness",
                "Fatigue",
                "Joint deformity (in severe cases)"
            ]
        },
        treatments: [
            { title: "Anti-Inflammatory Medications", desc: "NSAIDs and DMARDs to reduce inflammation and slow disease progression." },
            { title: "Physical Therapy", desc: "Exercises to maintain joint flexibility and strengthen supporting muscles." },
            { title: "Joint Protection", desc: "Assistive devices and techniques to reduce stress on affected joints." },
            { title: "Surgery", desc: "Joint replacement or repair procedures for severe cases." }
        ],
        medicalCannabis: {
            content1: "Medical cannabis shows promise for arthritis management due to its anti-inflammatory and analgesic properties. CBD, in particular, may help reduce joint inflammation and pain without psychoactive effects.",
            content2: "Both topical and systemic cannabis products can be beneficial for arthritis patients. Topicals provide localized relief, while oral products offer systemic anti-inflammatory effects."
        },
        faqs: [
            { question: "Can cannabis help with arthritis pain?", answer: "Many arthritis patients report significant pain relief with medical cannabis. Studies suggest cannabinoids may reduce inflammation and protect joints." },
            { question: "Should I use topicals or oral cannabis?", answer: "Both can be effective. Topicals provide targeted relief for specific joints, while oral products offer systemic benefits. Many patients use both." },
            { question: "Will it help with rheumatoid arthritis?", answer: "Some studies suggest cannabis may help manage RA symptoms by reducing inflammation and autoimmune responses, though more research is needed." }
        ]
    },
    {
        slug: "back-pain",
        name: "Back Pain",
        category: "Pain Management",
        categoryKey: "painManagement",
        image: "/condition-back-pain.jpg",
        description: "Chronic back pain affects millions worldwide. Medical cannabis offers a potential alternative for managing pain and inflammation when traditional treatments fail.",
        causes: [
            { title: "Muscle Strain", desc: "Repeated heavy lifting or sudden awkward movements can strain back muscles and spinal ligaments." },
            { title: "Bulging Discs", desc: "Discs act as cushions between vertebras. If they bulge or rupture, they can press on a nerve." },
            { title: "Arthritis", desc: "Osteoarthritis can affect the lower back. In some cases, spinal stenosis helps lead to narrowing of the space around the spinal cord." },
            { title: "Osteoporosis", desc: "Vertebrae can develop painful fractures if bones become porous and brittle." }
        ],
        symptoms: {
            physical: [
                "Muscle ache",
                "Shooting or stabbing pain",
                "Pain that radiates down your leg",
                "Limited flexibility or range of motion",
                "Inability to stand up straight"
            ]
        },
        treatments: [
            { title: "Physical Therapy", desc: "Exercises to increase flexibility, strengthen back and abdominal muscles, and improve posture." },
            { title: "Medications", desc: "NSAIDs, muscle relaxants, and topical pain relievers." },
            { title: "Injections", desc: "Cortisone injections into the epidural space can help decrease inflammation around nerve roots." },
            { title: "Surgery", desc: "Reserved for pain related to structural problems like narrowing of the spine (stenosis) or herniated discs." }
        ],
        medicalCannabis: {
            content1: "Cannabinoids can modulate pain thresholds and inhibit the release of pro-inflammatory molecules. THC and CBD work together to provide analgesic effects, often allowing patients to reduce their reliance on opioids or NSAIDs.",
            content2: "Strains high in CBD and terpenes like myrcene and beta-caryophyllene are often recommended for their anti-inflammatory and muscle-relaxing properties."
        },
        faqs: [
            { question: "Is cannabis better than opioids for back pain?", answer: "Many patients find cannabis effective for managing pain with fewer side effects and lower risk of dependency than opioids." },
            { question: "Can topical cannabis help?", answer: "Yes, transdermal patches and balms can provide localized relief for muscle soreness and inflammation without systemic psychoactive effects." }
        ]
    },
    {
        slug: "complex-regional-pain-syndrome",
        name: "Complex Regional Pain Syndrome (CRPS)",
        category: "Pain Management",
        categoryKey: "painManagement",
        image: "/condition-crps.jpg",
        description: "CRPS is a form of chronic pain that usually affects an arm or a leg. It typically develops after an injury, surgery, stroke or heart attack.",
        causes: [
            { title: "Trauma", desc: "Fractures, sprains/strains, soft tissue injury (such as burns or cuts)." },
            { title: "Surgery", desc: "Surgical procedures can sometimes trigger CRPS." },
            { title: "Immobilization", desc: "Creating a cast or splinting a limb can occasionally lead to CRPS." }
        ],
        symptoms: {
            physical: [
                "Continuous burning or throbbing pain",
                "Sensitivity to touch or cold",
                "Swelling of the painful area",
                "Changes in skin temperature",
                "Changes in skin color",
                "Changes in skin texture",
                "Joint stiffness"
            ]
        },
        treatments: [
            { title: "Rehabilitation Therapy", desc: "Physical therapy to keep the painful limb moving to improve blood flow and lessen the circulatory symptoms." },
            { title: "Psychotherapy", desc: "CRPS often causes profound psychological distress. Therapy can teach coping skills." },
            { title: "Medications", desc: "Pain relievers, types of antidepressants and anticonvulsants, and corticosteroids." }
        ],
        medicalCannabis: {
            content1: "CRPS is notoriously difficult to treat. Medical cannabis may offer relief by interacting with CB1 and CB2 receptors in the nervous system to dampen pain signals and reduce inflammation associated with the condition.",
            content2: "Patients often report that cannabis helps not only with the intense pain but also with the secondary symptoms of CRPS, such as insomnia and anxiety."
        },
        faqs: [
            { question: "Can cannabis stop CRPS?", answer: "While not a cure, it can significantly manage pain levels and improve quality of life." }
        ]
    },
    {
        slug: "epilepsy",
        name: "Epilepsy",
        category: "Neurological Disorders",
        categoryKey: "neurological",
        image: "/condition-epilepsy.jpg",
        description: "Epilepsy is a neurological disorder in which brain activity becomes abnormal, causing seizures or periods of unusual behavior, sensations, and sometimes loss of awareness.",
        causes: [
            { title: "Genetic Influence", desc: "Some types of epilepsy run in families." },
            { title: "Head Trauma", desc: "Car accidents or other traumatic injuries." },
            { title: "Brain Conditions", desc: "Brain tumors or strokes can cause epilepsy." },
            { title: "Infectious Diseases", desc: "Meningitis, AIDS and viral encephalitis." }
        ],
        symptoms: {
            physical: [
                "Temporary confusion",
                "Staring spells",
                "Uncontrollable jerking movements",
                "Loss of consciousness or awareness",
                "Psychological symptoms such as fear or anxiety"
            ]
        },
        treatments: [
            { title: "Anti-epileptic Drugs (AEDs)", desc: "The primary treatment to reduce the frequency and intensity of seizures." },
            { title: "Surgery", desc: "Removing the area of the brain causing seizures if medications fail." },
            { title: "Vagus Nerve Stimulation", desc: "A device implanted under the skin that sends bursts of electrical energy to the brain." }
        ],
        medicalCannabis: {
            content1: "CBD has been FDA-approved (Epidiolex) for treating certain severe forms of epilepsy (Lennox-Gastaut and Dravet syndrome). It reduces seizure frequency by interacting with non-cannabinoid receptors and ion channels.",
            content2: "Unlike THC, CBD is non-psychoactive and is generally well-tolerated, making it a viable option for pediatric patients with drug-resistant epilepsy."
        },
        faqs: [
            { question: "Is CBD safe for children with epilepsy?", answer: "Yes, specifically formulated CBD medications like Epidiolex are approved for children, but unregulated products should be used with caution." }
        ]
    },
    {
        slug: "insomnia",
        name: "Insomnia",
        category: "Sleep Disorders",
        categoryKey: "sleepDisorders",
        image: "/condition-insomnia.jpg",
        description: "Insomnia is a common sleep disorder that can make it hard to fall asleep, hard to stay asleep, or cause you to wake up too early and not be able to get back to sleep.",
        causes: [
            { title: "Stress", desc: "Concerns about work, school, health, finances or family can keep your mind active at night." },
            { title: "Travel or Work Schedule", desc: "Jet lag or shift work disrupts your body's circadian rhythms." },
            { title: "Poor Sleep Habits", desc: "Irregular bedtime, stimulating activities before bed, uncomfortable sleep environment." }
        ],
        symptoms: {
            physical: [
                "Difficulty falling asleep",
                "Waking up during the night",
                "Waking up too early",
                "Daytime tiredness or sleepiness",
                "Irritability, depression or anxiety",
                "Difficulty paying attention"
            ]
        },
        treatments: [
            { title: "CBT for Insomnia (CBT-I)", desc: "Helps you control or eliminate negative thoughts and actions that keep you awake." },
            { title: "Sleep Hygiene", desc: "Consistent sleep schedule, avoiding screens, and creating a relaxing environment." },
            { title: "Prescription Pills", desc: "Eszopiclone, ramelteon, zaleplon, zolpidem for short term use." }
        ],
        medicalCannabis: {
            content1: "THC acts as a sedative and can reduce sleep latency (time to fall asleep). CBD may help by treating underlying causes of insomnia, such as anxiety or pain.",
            content2: "Indica-dominant strains are traditionally preferred for sleep due to their relaxing, sedative effects, often attributed to terpenes like myrcene and linalool."
        },
        faqs: [
            { question: "Will cannabis affect my dreams?", answer: "THC is known to reduce REM sleep, which reduces dreaming. This can be beneficial for those with PTSD-related nightmares." }
        ]
    },
    {
        slug: "migraines",
        name: "Migraines & Headaches",
        category: "Pain Management",
        categoryKey: "painManagement",
        image: "/condition-migraines.jpg",
        description: "A migraine is a headache that can cause severe throbbing pain or a pulsing sensation, usually on one side of the head, often accompanied by nausea, vomiting, and extreme sensitivity to light and sound.",
        causes: [
            { title: "Hormonal Changes", desc: "Fluctuations in estrogen can trigger headaches in many women." },
            { title: "Drinks", desc: "Alcohol, especially wine, and too much caffeine." },
            { title: "Stress", desc: "Sensory stimuli like bright lights and sun glare." },
            { title: "Sleep Changes", desc: "Missing sleep or getting too much sleep." }
        ],
        symptoms: {
            physical: [
                "Severe throbbing pain",
                "Sensitivity to light and sound",
                "Nausea and vomiting",
                "Visual disturbances (aura)",
                "Dizziness"
            ]
        },
        treatments: [
            { title: "Pain Relievers", desc: "Aspirin or ibuprofen for mild migraines." },
            { title: "Triptans", desc: "Prescription drugs that block pain pathways in the brain." },
            { title: "Preventive Medications", desc: "Beta blockers, antidepressants, or anti-seizure drugs." }
        ],
        medicalCannabis: {
            content1: "The endocannabinoid system plays a role in pain regulation. Research suggests that migraine sufferers may have an endocannabinoid deficiency. Cannabis can supplement this system to reduce frequency and intensity.",
            content2: "Both inhaled (for acute attacks - fast acting) and preventive daily use (CBD oils) are common strategies for migraine management."
        },
        faqs: [
            { question: "Does vaping help a migraine immediately?", answer: "Inhalation methods provide the quickest relief, taking effect in minutes, which is crucial during the onset of a migraine attack." }
        ]
    },
    {
        slug: "multiple-sclerosis",
        name: "Multiple Sclerosis (MS)",
        category: "Neurological Disorders",
        categoryKey: "neurological",
        image: "/condition-ms.jpg",
        description: "MS is a potentially disabling disease of the brain and spinal cord (central nervous system). In MS, the immune system attacks the protective sheath (myelin) that covers nerve fibers.",
        causes: [
            { title: "Autoimmune", desc: "The body's immune system attacks its own tissues." },
            { title: "Environmental Factors", desc: "Low Vitamin D and smoking are linked to higher risks." },
            { title: "Genetics", desc: "A combination of genetic susceptibility and environmental factors." }
        ],
        symptoms: {
            physical: [
                "Numbness or weakness in limbs",
                "Electric-shock sensations",
                "Tremor, lack of coordination",
                "Vision problems",
                "Slurred speech",
                "Fatigue"
            ]
        },
        treatments: [
            { title: "Corticosteroids", desc: "Used to reduce nerve inflammation during attacks." },
            { title: "Disease-modifying therapies", desc: "Drugs to slow disease progression." },
            { title: "Physical Therapy", desc: "Strengthening and stretching exercises to maintain mobility." }
        ],
        medicalCannabis: {
            content1: "Medical cannabis is widely used for MS to treat spasticity (muscle stiffness and spasms) and neuropathic pain. Sativex, a cannabis-based mouth spray, is approved in many countries specifically for MS spasticity.",
            content2: "It may also help with bladder dysfunction and sleep disturbances commonly associated with MS."
        },
        faqs: [
            { question: "Does cannabis help with MS tremors?", answer: "Some patients report reduction in tremors, though the primary evidence supports its use for spasticity and pain." }
        ]
    },
    {
        slug: "neuropathic-pain",
        name: "Neuropathic Pain",
        category: "Pain Management",
        categoryKey: "painManagement",
        image: "/condition-neuropathic-pain.jpg",
        description: "Neuropathic pain is caused by damage or injury to the nerves that transfer information between the brain and spinal cord from the skin, muscles and other parts of the body.",
        causes: [
            { title: "Diabetes", desc: "Diabetic neuropathy is a common cause." },
            { title: "Shingles", desc: "Postherpetic neuralgia follows a shingles outbreak." },
            { title: "Chemotherapy", desc: "Certain cancer drugs can damage nerves." },
            { title: "Injury", desc: "Tissue injury can damage nerves directly." }
        ],
        symptoms: {
            physical: [
                "Shooting, burning or stabbing pain",
                "Tingling or numbness",
                "Spontaneous pain",
                "Evoked pain (pain from a stimulus that doesn't normally cause pain)",
                "Trouble sleeping"
            ]
        },
        treatments: [
            { title: "Anticonvulsants", desc: "Drugs like gabapentin and pregabalin." },
            { title: "Antidepressants", desc: "Tricyclic antidepressants and SNRIs." },
            { title: "Topical Treatments", desc: "Lidocaine patches or capsaicin cream." }
        ],
        medicalCannabis: {
            content1: "Neuropathic pain is often resistant to traditional painkillers. Cannabinoids regulate neurotransmitter release in the dorsal spinal cord, dampening pain signals.",
            content2: "Balanced THC:CBD strains are often most effective, leveraging the 'entourage effect' to target nerve pain without excessive sedation."
        },
        faqs: [
            { question: "Is cannabis effective for diabetic neuropathy?", answer: "Yes, studies have shown that inhaled cannabis can significantly reduce diabetic neuropathy pain in patients where other treatments failed." }
        ]
    },
    {
        slug: "parkinsons-disease",
        name: "Parkinson's Disease",
        category: "Neurological Disorders",
        categoryKey: "neurological",
        image: "/condition-parkinsons.jpg",
        description: "Parkinson's disease is a progressive nervous system disorder that affects movement. Symptoms start gradually, sometimes starting with a barely noticeable tremor in just one hand.",
        causes: [
            { title: "Genes", desc: "Specific genetic mutations can cause Parkinson's." },
            { title: "Environmental triggers", desc: "Exposure to certain toxins or environmental factors may increase the risk." },
            { title: "Lewy bodies", desc: "Clumps of specific substances within brain cells." }
        ],
        symptoms: {
            physical: [
                "Tremor",
                "Slowed movement (bradykinesia)",
                "Rigid muscles",
                "Impaired posture and balance",
                "Loss of automatic movements",
                "Speech changes"
            ]
        },
        treatments: [
            { title: "Carbidopa-levodopa", desc: "The most effective medication for Parkinson's disease." },
            { title: "Dopamine agonists", desc: "Mimic dopamine effects in your brain." },
            { title: "Deep Brain Stimulation", desc: "Surgical implantation of electrodes." }
        ],
        medicalCannabis: {
            content1: "Cannabis may help manage Parkinson's symptoms such as tremors, stiffness (rigidity), and bradykinesia. It can also assist with secondary symptoms like anxiety, pain, and sleep dysfunction.",
            content2: "Neuroprotective properties of cannabinoids are also being investigated to see if they can slow the progression of dopaminergic neuron loss."
        },
        faqs: [
            { question: "Can cannabis replace Levodopa?", answer: "No, it is an adjunctive therapy. Do not stop prescribed Parkinson's medication without a specialist's supervision." }
        ]
    },
    {
        slug: "ptsd",
        name: "PTSD",
        category: "Mental Health",
        categoryKey: "mentalHealth",
        image: "/condition-ptsd.jpg",
        description: "Post-traumatic stress disorder (PTSD) is a mental health condition that's triggered by a terrifying event — either experiencing it or witnessing it.",
        causes: [
            { title: "Stressful Experiences", desc: "Combat exposure, childhood abuse, or sexual violence." },
            { title: "Inherited Medical Risks", desc: "Family history of anxiety and depression." },
            { title: "Temperament", desc: "Inherited aspects of your personality." }
        ],
        symptoms: {
            physical: [
                "Being easily startled or frightened",
                "Always being on guard for danger",
                "Self-destructive behavior",
                "Trouble sleeping",
                "Trouble concentrating"
            ],
            psychological: [
                "Intrusive memories",
                "Flashbacks",
                "Nightmares",
                "Severe emotional distress",
                "Avoidance of reminders"
            ]
        },
        treatments: [
            { title: "Cognitive Therapy", desc: "Recognizing patterns of thinking (cognitive distortions)." },
            { title: "Exposure Therapy", desc: "Safely facing both situations and memories that you find frightening." },
            { title: "EMDR", desc: "Eye movement desensitization and reprocessing." }
        ],
        medicalCannabis: {
            content1: "Cannabis can aid in 'extinction learning', the process of overwriting traumatic associations. It creates a buffer that may reduce the intensity of flashbacks and nightmares.",
            content2: "THC helps reduce REM sleep (reducing nightmares), while CBD can manage the hyperarousal and anxiety components of PTSD."
        },
        faqs: [
            { question: "Does it help with nightmares?", answer: "Yes, many veterans and patients use cannabis specifically to suppress nightmares and improve sleep continuity." }
        ]
    }
];

async function seedConditions() {
    console.log('🌱 Seeding conditions...');

    // Find healing buds tenant
    const tenant = await prisma.tenants.findUnique({
        where: { subdomain: 'healingbuds' }
    });

    if (!tenant) {
        console.error('❌ Error: HealingBuds tenant not found');
        process.exit(1);
    }

    console.log(`Found tenant: ${tenant.businessName} (${tenant.id})`);

    for (const condition of conditionsData) {
        console.log(`Processing: ${condition.name}`);

        await prisma.conditions.upsert({
            where: {
                tenantId_slug: {
                    tenantId: tenant.id,
                    slug: condition.slug
                }
            },
            update: {
                name: condition.name,
                category: condition.category,
                categoryKey: condition.categoryKey,
                image: condition.image,
                description: condition.description || `${condition.name} treatment options.`,
                causes: condition.causes || [],
                symptoms: condition.symptoms || {},
                types: condition.types || [],
                treatments: condition.treatments || [],
                medicalCannabis: condition.medicalCannabis || { content1: "", content2: "" },
                faqs: condition.faqs || []
            },
            create: {
                id: crypto.randomUUID(),
                updatedAt: new Date(),
                tenantId: tenant.id,
                slug: condition.slug,
                name: condition.name,
                category: condition.category,
                categoryKey: condition.categoryKey,
                image: condition.image,
                description: condition.description || `${condition.name} treatment options.`,
                causes: condition.causes || [],
                symptoms: condition.symptoms || {},
                types: condition.types || [],
                treatments: condition.treatments || [],
                medicalCannabis: condition.medicalCannabis || { content1: "", content2: "" },
                faqs: condition.faqs || []
            }
        });
    }

    console.log('✅ Conditions seeded successfully!');
}

seedConditions()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
