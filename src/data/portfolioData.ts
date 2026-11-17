export interface Certification {
  id: string;
  title: string;
  issuer: string;
  issueDate: string;
  expiryDate?: string;
  credentialId?: string;
  credentialUrl?: string;
  category: 'ai' | 'cloud' | 'data';
  badgeColor: string;
  skills: string[];
}

export interface ExperienceRole {
  role: string;
  period: string;
  location: string;
  employmentType?: string;
  domain?: string;
  highlights: string[];
  recognitionBadge?: string;
  technologies: string[];
}

export interface CompanyExperience {
  company: string;
  companyTag: string;
  tenure: string;
  location: string;
  roles: ExperienceRole[];
}

export interface Award {
  id: string;
  title: string;
  organization: string;
  date: string;
  category: string;
  description: string;
  associatedWith?: string;
}

export interface Recommendation {
  id: string;
  author: string;
  role: string;
  date: string;
  relationship: string;
  relationshipType: 'manager' | 'direct_report' | 'peer';
  quote: string;
  featured?: boolean;
}

export const PERSONAL_INFO = {
  name: 'Mohammed Sufyan',
  title: 'Software Engineer — Cloud Solutions Architect / Trust Organization DFOV / DFS Operations / Cloud Solutions Architect',
  tagline: 'Architecting high-velocity systems for distributed platforms, multi-cloud scalability, resilience and cloud governance across diverse ecosystems. 13+ years of enterprise experience with Cisco, HCL Technologies, and Tata Consultancy Services in the United States, United Kingdom, and India.',
  email: 'sufyan.net@gmail.com',
  linkedin: 'https://www.linkedin.com/in/mohammed-sufyan',
  location: 'San Jose, California, United States · Hybrid',
  experienceYears: '13+',
  certificationsCount: '20x',
  enterpriseClients: '28+',
  academicCgpa: '9.5/10',
  philosophy: {
    quote1: "Throughout my life, I've approached every challenge with enthusiasm, creativity, and commitment to achieve success. Thousand and One Rare achievements continue to fuel my unique experience and exceptional commitment to personal and professional integrity.",
    body: 'Senior Systems and Cloud Solutions Architect with 13+ years of experience spanning Cisco Systems Inc., HCL America Inc., and Tata Consultancy Services across high-throughput and high-compliance enterprise domains. Lead and build architectures across multi-cloud footprints (AWS, Azure, GCP), with deep specialization in Zero Trust architectures, telemetry pipelines, distributed cloud infrastructure, microservices, and cross-platform resilience.',
    poem: 'Knowledge is my companion,\nit boasts me wherever I go.\nMy heart is its container, and\nnot the bookshelf.',
    poemAuthor: 'Mohammed Sufyan, Principal Cloud Architect'
  }
};

export const STATS = [
  {
    value: '13+',
    label: 'YEARS ENTERPRISE EXPERIENCE',
    sublabel: 'Cisco • HCL America • TCS'
  },
  {
    value: '20x',
    label: 'CERTIFIED & ACCREDITED',
    sublabel: 'AWS • Azure • GCP • Databricks • AI'
  },
  {
    value: '20+',
    label: 'CORPORATE HONORS & AWARDS',
    sublabel: 'Achievers League • Spark • Cisco Play to Win'
  },
  {
    value: '9.5',
    fraction: '/10',
    label: 'ACADEMIC CGPA',
    sublabel: 'B.E. Computer Science'
  }
];

export const TECHNICAL_DISCIPLINES = [
  {
    id: 'ai-genai',
    title: 'AI, GenAI & Agentic AI',
    status: 'CONTINUOUS LAB EXP.',
    description: 'Generative AI systems, LLM orchestration, agentic reasoning, vector databases, RAG architectures, prompt engineering.',
    technologies: ['Agentic Workflows', 'RAG Architecture', 'Vector Databases', 'Prompt Engineering', 'LangChain', 'LlamaIndex', 'OpenAI API', 'Claude'],
    level: 95
  },
  {
    id: 'python-scripting',
    title: 'Python & Scripting',
    status: 'PRIMARY',
    description: 'High-performance scripting, async concurrency, data processing, automation tooling, and enterprise API engineering.',
    technologies: ['Python (Programming Language)', 'Asyncio', 'FastAPI', 'Django 5', 'Django REST Framework', 'Shell Scripting', 'DuckDB', 'SQLAlchemy', 'pandas'],
    level: 96
  },
  {
    id: 'cloud-platforms',
    title: 'Cloud Platforms',
    status: 'MULTI-CLOUD',
    description: 'Enterprise multi-cloud architecture, hybrid topology governance, resilient microservices, and infrastructure standards.',
    technologies: ['AWS (S3, Redshift, DynamoDB)', 'Microsoft Azure', 'Google Cloud Platform (GCP / BigQuery)', 'Databricks', 'OpenShift', 'Multi-Cloud Governance'],
    level: 98
  },
  {
    id: 'devops-containers',
    title: 'DevOps & Containers',
    status: 'PRODUCTION',
    description: 'End-to-end container orchestration, declarative infrastructure-as-code, GitOps workflows, and automated release cycles.',
    technologies: ['Docker', 'Kubernetes (EKS/AKS/GKE)', 'CI/CD Pipelines', 'GitLab CI/CD', 'GitHub Actions', 'Terraform', 'UV Devcontainers', 'Ansible'],
    level: 94
  },
  {
    id: 'security-governance',
    title: 'Security & Governance',
    status: 'ZERO TRUST',
    description: 'Zero Trust architectural standards, identity boundaries, posture management, secrets encryption, and compliance audits.',
    technologies: ['Project Atlas Security Platform', 'Zero Trust Architecture', 'Cloud Security', 'HashiCorp Vault', 'Tenable Vulnerability Scanners', 'Wiz Integration', 'JupiterOne Graph', 'OWASP ZAP'],
    level: 97
  },
  {
    id: 'observability-telemetry',
    title: 'Cloud Observability & Monitoring',
    status: 'ENTERPRISE SCALE',
    description: 'Centralized high-throughput log analytics, distributed tracing, proactive metric probing, and automated SLI/SLO alerting.',
    technologies: ['Splunk / Splunk Cloud', 'OpenShift CronJob Observability', 'Statistical Anomaly Detection', 'Dynatrace APM', 'Grafana / Prometheus', 'ArangoDB', 'RabbitMQ', 'Celery'],
    level: 96
  }
];

export const WORK_EXPERIENCE: CompanyExperience[] = [
  {
    company: 'Cisco',
    companyTag: 'CURRENT ROLE · FULL-TIME',
    tenure: 'Aug 2026 — Present · 3 mos',
    location: 'San Jose, California, United States · Hybrid',
    roles: [
      {
        role: 'Software Engineer',
        period: 'Aug 2026 — Present · 3 mos',
        location: 'San Jose, California, United States · Hybrid',
        employmentType: 'Full-time',
        domain: 'Cisco Security & Trust Organization (STO) CTO Operations · Project Atlas',
        highlights: [
          'Software Engineer in Cisco Security & Trust Organization (STO) CTO Operations, building the security data platform at the core of Project Atlas — a unified, governed foundation that consolidates shared services, standardizes data, and enables teams to build, automate, and innovate with confidence.',
          'Design and implement APIs and data pipelines to ingest, process, and manage large volumes of structured and unstructured security data across the STO data platform.',
          'Build and optimize scalable software for Project Atlas Minimum Viable Architecture (MVA) — focusing on code quality, system architecture, and performance of large-scale data processing systems.',
          'Own features end-to-end: development, infrastructure enhancements, and integration with enterprise data systems across a globally distributed STO team.',
          'Deploy and operate platform infrastructure on AWS/Azure/GCP, using Docker, Kubernetes, and CI/CD for containerized, production-ready services.',
          'Work across Python, Databricks, SQL/NoSQL stores, and cloud data services (S3, Redshift, BigQuery) to deliver high-performance, governed data solutions.'
        ],
        technologies: ['Python (Programming Language)', 'Microservices', 'Databricks', 'AWS / Azure / GCP', 'Docker', 'Kubernetes', 'CI/CD', 'S3', 'Redshift', 'BigQuery', 'SQL/NoSQL', 'Project Atlas']
      }
    ]
  },
  {
    company: 'HCL America Inc.',
    companyTag: 'FULL-TIME · 7 YRS',
    tenure: 'Sep 2019 — Aug 2026 · 7 yrs',
    location: 'San Francisco Bay Area, United States & Bengaluru, India',
    roles: [
      {
        role: 'Technical Manager/Architect',
        period: 'Oct 2024 — Aug 2026 · 1 yr 11 mos',
        location: 'San Francisco Bay Area · Hybrid',
        employmentType: 'Full-time',
        domain: 'Multi-Cloud Vulnerability Orchestration & AI Document Retrieval · Cisco Account',
        recognitionBadge: '4 Consecutive Quarterly Awards (ERS Star Champion, HCL Achievers League)',
        highlights: [
          'Architected a multi-cloud vulnerability orchestration platform for Cisco Systems Inc. — integrating Tenable scanner plugins, async Python, AWS S3/DynamoDB, and DuckDB to orchestrate enterprise-scale scan scheduling, execution, and result ingestion across global infrastructure.',
          'Designed and delivered an AI-powered document retrieval system using RAG architecture — ingesting enterprise ServiceNow documents into a vector store with incremental sync, enabling natural-language security knowledge search for Cisco\'s engineering teams.',
          'Engineered OpenShift CronJob observability tooling with statistical anomaly detection — providing zero-config health monitoring for compliance pipeline workloads across missed runs, success-rate degradation, and period-over-period performance comparison.',
          'Designed an internal Python project generator CLI, standardising all security engineering project scaffolding with UV, Docker devcontainers, pre-commit security gates (bandit, mypy, ruff), and GitHub automation — reducing new project bootstrap time from days to minutes.',
          'Recognised with 4 consecutive quarterly awards (ERS Star Champion, HCL Achievers League) for outstanding architecture and delivery on the Cisco account.'
        ],
        technologies: ['Agentic Workflows', 'Python (Programming Language)', 'Tenable', 'Async Python', 'AWS S3 / DynamoDB', 'DuckDB', 'RAG Architecture', 'Vector Store', 'OpenShift', 'Statistical Anomaly Detection', 'UV Devcontainers']
      },
      {
        role: 'Senior Technical Lead',
        period: 'Dec 2023 — Sep 2024 · 10 mos',
        location: 'San Francisco Bay Area',
        employmentType: 'Full-time',
        domain: 'SVIC JupiterOne API & Security Graph Data Pipelines · Cisco Account',
        highlights: [
          'Led engineering of the SVIC JupiterOne API — a Django 5 + Django REST Framework REST service with async J1QL query jobs, Wiz findings integration, and Tenable findings endpoints, bridging Cisco\'s security graph data to downstream analytics consumers.',
          'Designed and implemented a J1QL-to-SQL translation library enabling Cisco\'s JupiterOne security graph data to be queried against a relational data warehouse — unlocking SQL-native analytics across graph-origin vulnerability data.',
          'Built and maintained 5 JupiterOne data ingestion pipelines (Wiz, ServiceNow/ESP, Symphony/Tenable, fixed findings, plugin metadata) — keeping Cisco\'s security graph continuously current and audit-ready.'
        ],
        technologies: ['Python (Programming Language)', 'Shell Scripting', 'Django 5', 'Django REST Framework', 'J1QL', 'Wiz', 'Tenable', 'JupiterOne', 'SQL Translation', 'Security Graph']
      },
      {
        role: 'Senior Technical Lead',
        period: 'Jul 2022 — Nov 2023 · 1 yr 5 mos',
        location: 'Bengaluru, Karnataka, India',
        employmentType: 'Full-time',
        domain: 'UCT/CSBIT Cloud Security Audit Platform & CSEO Compliance Pipelines',
        recognitionBadge: 'HCL Achievers League O3, Shining Star (×2), and ERS Knowledge Champion',
        highlights: [
          'Architected and maintained the UCT/CSBIT cloud security audit platform — an event-driven microservices system (Flask, OpenShift, RabbitMQ, MongoDB, HashiCorp Vault, Celery) for running pluggable compliance guardrail scans (Nmap, OWASP ZAP, SSL/TLS auditing) against Cisco cloud tenants.',
          'Engineered the core compliance pipeline v5 stream and batch processing framework (SQLAlchemy, pandas, APScheduler, JSON schema validation, ArangoDB) — the foundational ETL engine powering all CSEO security data pipelines.',
          'Built the Security Issue Rating (SIR) library — a configurable risk scoring engine for Tenable/Symphony vulnerability findings, incorporating business context rules to prioritise remediation across Cisco\'s infrastructure.',
          'Recognised with 4 awards: HCL Achievers League O3, Shining Star (×2), and ERS Knowledge Champion for sustained technical excellence on the Cisco account.'
        ],
        technologies: ['Agentic Workflows', 'Python (Programming Language)', 'Flask', 'OpenShift', 'RabbitMQ', 'MongoDB', 'HashiCorp Vault', 'Celery', 'SQLAlchemy', 'pandas', 'APScheduler', 'ArangoDB']
      },
      {
        role: 'Technical Lead',
        period: 'Sep 2019 — Jun 2022 · 2 yrs 10 mos',
        location: 'Bengaluru, Karnataka, India',
        employmentType: 'Full-time',
        domain: 'Initial Cloud Compliance Infrastructure & Cisco Continuous Security Buddy Project',
        recognitionBadge: '6 Awards: Delivery Excellence, Technical Excellence, ERS Knowledge Champion (×2), Spark Award',
        highlights: [
          'Led development of initial UCT/CSBIT cloud compliance scanning infrastructure for Cisco Systems — establishing the microservices architecture, scan service REST API, and audit orchestration layer that became Cisco\'s internal cloud security guardrail platform.',
          'Built automated vulnerability scan ingestion pipelines integrating Symphony and Tenable data sources — standardising security finding formats and enabling centralised tracking across Cisco\'s multi-cloud environment.',
          'Introduced GitLab CI/CD pipelines and standardised Python project structures across the CSEO engineering team — improving code quality, reducing integration errors, and accelerating delivery cadence.',
          'Recognised with 6 awards including Delivery Excellence, Technical Excellence, ERS Knowledge Champion (×2), and Spark Award for outstanding delivery on the Cisco Continuous Security Buddy Project.'
        ],
        technologies: ['Python (Programming Language)', 'Cloud Security', 'GitLab CI/CD', 'Microservices', 'REST API', 'Tenable', 'Symphony', 'Audit Orchestration']
      }
    ]
  },
  {
    company: 'Tata Consultancy Services',
    companyTag: 'FULL-TIME · 5 YRS 9 MOS',
    tenure: 'Dec 2013 — Aug 2019 · 5 yrs 9 mos',
    location: 'Bengaluru, India & Greater London, United Kingdom',
    roles: [
      {
        role: 'IT Analyst',
        period: 'Jan 2018 — Aug 2019 · 1 yr 8 mos',
        location: 'Bengaluru, Karnataka, India',
        employmentType: 'Full-time',
        domain: 'Technical Analysis & Enterprise Solution Delivery',
        recognitionBadge: 'On the Spot award (Aug 2017) & Service Commitment award (Jan 2019)',
        highlights: [
          'Progressed to IT Analyst level, taking ownership of technical analysis, solution design, and end-to-end delivery of software components for enterprise clients.',
          'Led technical discussions with clients and business analysts to translate complex business requirements into scalable, maintainable technical designs.',
          'Mentored junior engineers (ASE/SE level) — conducting code reviews, knowledge-sharing sessions, and providing guidance on development best practices.',
          'Drove process improvements within the delivery team — identifying automation opportunities and implementing tooling that reduced manual effort in testing and deployment workflows.',
          'Recognised with On the Spot award (Aug 2017) for outstanding contribution and Service Commitment award (Jan 2019) for 5+ years of tenure with TCS.'
        ],
        technologies: ['Python (Programming Language)', 'Shell Scripting', 'Enterprise Delivery', 'Technical Architecture', 'Process Automation']
      },
      {
        role: 'System Engineer',
        period: 'Sep 2017 — Dec 2017 · 4 mos',
        location: 'Bengaluru, Karnataka, India',
        employmentType: 'Full-time',
        domain: 'System Engineering & Knowledge Transition',
        highlights: [
          'Re-integrated with the Bengaluru delivery centre following international assignment — transitioned project knowledge and continued contributing to system engineering and application support activities.',
          'Supported knowledge transfer for new team members and documented technical processes to improve team onboarding efficiency.'
        ],
        technologies: ['Python (Programming Language)', 'Shell Scripting', 'Application Support']
      },
      {
        role: 'System Engineer',
        period: 'Sep 2016 — Aug 2017 · 1 yr',
        location: 'Greater London, England, United Kingdom',
        employmentType: 'Full-time',
        domain: 'International Client Engagement & Production Operations',
        highlights: [
          'Deployed to a London-based client engagement — delivered technical solutions in an onshore capacity, working directly with client stakeholders to gather requirements, resolve issues, and drive timely delivery.',
          'Acted as a bridge between the offshore development team in Bengaluru and the onshore client — coordinating daily stand-ups, managing task hand-offs, and ensuring alignment on deliverables.',
          'Supported production environments and responded to client-raised incidents, meeting SLA commitments in a high-visibility, client-facing role.',
          'Gained international delivery experience working within a multicultural, enterprise technology environment across UK business and regulatory contexts.'
        ],
        technologies: ['Python (Programming Language)', 'Shell Scripting', 'Client Engagement', 'Incident Management', 'SLA Adherence']
      },
      {
        role: 'Assistant System Engineer',
        period: 'Jan 2015 — Aug 2016 · 1 yr 8 mos',
        location: 'Bengaluru, Karnataka, India',
        employmentType: 'Full-time',
        domain: 'Application Engineering & Automated Regression Testing',
        highlights: [
          'Contributed to the design, development, and testing of enterprise application modules — delivering features across the full development lifecycle from requirements analysis through to deployment.',
          'Performed root cause analysis and resolution of production issues, reducing recurring defects and improving system stability for client environments.',
          'Wrote automated test scripts and participated in regression testing cycles — improving test coverage and reducing manual QA effort for iterative releases.',
          'Collaborated with cross-functional teams (business analysts, QA, infrastructure) to deliver high-quality software on schedule in a fast-paced IT services environment.'
        ],
        technologies: ['Python (Programming Language)', 'Shell Scripting', 'Automated Test Scripts', 'Root Cause Analysis', 'Regression Testing']
      },
      {
        role: 'Assistant System Engineer Trainee',
        period: 'Dec 2013 — Dec 2014 · 1 yr 1 mo',
        location: 'Bengaluru, Karnataka, India',
        employmentType: 'Full-time',
        domain: 'Initial Learning Program (ILP) & Agile Delivery',
        highlights: [
          'Completed TCS Initial Learning Program (ILP) — full-stack technical training covering software development fundamentals, Java, SQL, Unix, and SDLC methodologies.',
          'Developed and unit-tested software modules as part of an enterprise application delivery team, gaining hands-on experience with agile development practices and code review workflows.',
          'Collaborated with senior engineers to analyse business requirements and contribute to technical design documentation for client-facing solutions.'
        ],
        technologies: ['Python (Programming Language)', 'Shell Scripting', 'Java', 'SQL', 'Unix', 'Agile Practices']
      }
    ]
  }
];

export interface CertificationCategory {
  id: string;
  name: string;
  count: number;
  certs: Certification[];
}

export const CERTIFICATION_CATEGORIES: CertificationCategory[] = [
  {
    id: 'ai',
    name: 'AI, GenAI & Applied Science',
    count: 11,
    certs: [
      {
        id: 'cert-house-of-edtech-ai',
        title: 'Certified AI Product & Content Creation Specialist',
        issuer: 'House of EDTECH',
        issueDate: 'NOV 2026',
        credentialId: '2421bccf-9ffa-4473-9dc3-648f965bc58b',
        credentialUrl: 'https://app.aicareeraccelerator.in/certificate/FrFqy-TSsOOEvk0',
        category: 'ai',
        badgeColor: 'border-cyan-500/40 text-cyan-300',
        skills: ['AI Product Strategy', 'Content Creation', 'Generative AI Tools']
      },
      {
        id: 'cert-be10x-ai',
        title: 'AI Tools Workshop Certificate',
        issuer: 'Be10x',
        issueDate: 'OCT 2026',
        credentialId: '0cddb817-1ee3-4ef8-98c3-9a5b75a7167d',
        credentialUrl: 'https://app.aicareeraccelerator.in/certificate/3Du1oF_m_VBq47b',
        category: 'ai',
        badgeColor: 'border-cyan-500/40 text-cyan-300',
        skills: ['AI Tools', 'Prompt Engineering', 'Productivity Automation']
      },
      {
        id: 'cert-db-ai-agent',
        title: 'Academy Accreditation - AI Agent Fundamentals',
        issuer: 'Databricks',
        issueDate: 'APR 2026',
        credentialId: '179397856',
        credentialUrl: 'https://credentials.databricks.com/179397856',
        category: 'ai',
        badgeColor: 'border-cyan-500/40 text-cyan-300',
        skills: ['Agentic Workflows', 'Python (Programming Language)']
      },
      {
        id: 'cert-db-fund',
        title: 'Academy Accreditation - Databricks Fundamentals',
        issuer: 'Databricks',
        issueDate: 'APR 2026',
        credentialId: '179390364',
        credentialUrl: 'https://credentials.databricks.com/179390364',
        category: 'ai',
        badgeColor: 'border-cyan-500/40 text-cyan-300',
        skills: ['Python (Programming Language)', 'Databricks Products']
      },
      {
        id: 'cert-skillsoft-track1',
        title: 'Track 1: Prompt-driven Python Learning',
        issuer: 'Skillsoft',
        issueDate: 'NOV 2024',
        credentialId: '122176163',
        credentialUrl: 'https://skillsoft.digitalbadges.skillsoft.com/833c1c3b-8c8e-40ef-9773-1784fdc83c73',
        category: 'ai',
        badgeColor: 'border-cyan-500/40 text-cyan-300',
        skills: ['Agentic Workflows', 'Python Prompting']
      },
      {
        id: 'cert-skillsoft-prog',
        title: 'Prompt Engineering for Programmers to Learn Python',
        issuer: 'Skillsoft',
        issueDate: 'NOV 2024',
        credentialId: '122176162',
        credentialUrl: 'https://skillsoft.digitalbadges.skillsoft.com/317799b9-f248-4ed8-9a23-fdf382642271',
        category: 'ai',
        badgeColor: 'border-cyan-500/40 text-cyan-300',
        skills: ['Agentic Workflows', 'Prompt-driven Development']
      },
      {
        id: 'cert-skillsoft-ethical',
        title: 'Ethical, Privacy, & Intellectual Property Considerations for ChatGPT',
        issuer: 'Skillsoft',
        issueDate: 'NOV 2024',
        credentialId: '122123712',
        credentialUrl: 'https://skillsoft.digitalbadges.skillsoft.com/151245a9-f63c-4cc0-b397-7eaa9ed47ea8',
        category: 'ai',
        badgeColor: 'border-cyan-500/40 text-cyan-300',
        skills: ['Agentic Workflows', 'AI Governance & Privacy']
      },
      {
        id: 'cert-skillsoft-explore',
        title: 'Exploring Prompt Engineering Techniques',
        issuer: 'Skillsoft',
        issueDate: 'NOV 2024',
        credentialId: '122113449',
        credentialUrl: 'https://skillsoft.digitalbadges.skillsoft.com/6488fc42-f3cf-40a4-95d6-3b1b37222ad4',
        category: 'ai',
        badgeColor: 'border-cyan-500/40 text-cyan-300',
        skills: ['Agentic Workflows', 'Advanced Prompting']
      },
      {
        id: 'cert-skillsoft-intro',
        title: 'An Introduction to Generative AI',
        issuer: 'Skillsoft',
        issueDate: 'NOV 2024',
        credentialId: '122107703',
        credentialUrl: 'https://skillsoft.digitalbadges.skillsoft.com/a1d1d457-cd96-410c-be59-6e364e40f5ce',
        category: 'ai',
        badgeColor: 'border-cyan-500/40 text-cyan-300',
        skills: ['Agentic Workflows', 'Generative AI Foundations']
      },
      {
        id: 'cert-google-genai',
        title: 'Generative AI Fundamentals',
        issuer: 'Google',
        issueDate: 'SEP 2024',
        credentialId: '11693587',
        credentialUrl: 'https://partner.cloudskillsboost.google/public_profiles/53e3a321-8e1e-4278-982e-416b904d97cd/badges/11693587?utm_medium=social&utm_source=linkedin&utm_campaign=ql-social-share',
        category: 'ai',
        badgeColor: 'border-cyan-500/40 text-cyan-300',
        skills: ['Agentic Workflows', 'Large Language Models']
      },
      {
        id: 'cert-aws-genai',
        title: 'AWS Partner: Generative AI Essentials',
        issuer: 'Amazon Web Services (AWS)',
        issueDate: 'MAR 2024',
        credentialUrl: 'https://www.credly.com/badges/7372d43c-625a-4637-968d-8d1f4ca345da/linked_in_profile',
        category: 'ai',
        badgeColor: 'border-cyan-500/40 text-cyan-300',
        skills: ['Amazon Web Services (AWS)', 'Agentic Workflows']
      }
    ]
  },
  {
    id: 'cloud',
    name: 'Cloud & DevOps Architecture',
    count: 7,
    certs: [
      {
        id: 'cert-aws-devops-pro',
        title: 'AWS Certified DevOps Engineer – Professional',
        issuer: 'Amazon Web Services (AWS)',
        issueDate: 'OCT 2023',
        expiryDate: 'OCT 2026',
        credentialUrl: 'https://www.credly.com/badges/b4638dbe-f043-4be0-874f-4d128da93575/linked_in_profile',
        category: 'cloud',
        badgeColor: 'border-cyan-500/40 text-cyan-300',
        skills: ['Amazon Web Services (AWS)', 'Cloud Security', 'DevOps Automation']
      },
      {
        id: 'cert-aws-saa',
        title: 'AWS Certified Solutions Architect – Associate',
        issuer: 'Amazon Web Services (AWS)',
        issueDate: 'OCT 2023',
        expiryDate: 'OCT 2026',
        credentialUrl: 'https://www.credly.com/badges/2f92a47b-82f7-4a38-8cd1-12f682aa95db/linked_in_profile',
        category: 'cloud',
        badgeColor: 'border-cyan-500/40 text-cyan-300',
        skills: ['Amazon Web Services (AWS)', 'Cloud Security', 'Resilient Architecture']
      },
      {
        id: 'cert-google-ace',
        title: 'Associate Cloud Engineer',
        issuer: 'Google',
        issueDate: 'FEB 2022',
        expiryDate: 'FEB 2025',
        credentialId: '45798304',
        credentialUrl: 'https://www.credential.net/a58baa45-822d-48df-85b3-f82c67991f48',
        category: 'cloud',
        badgeColor: 'border-cyan-500/40 text-cyan-300',
        skills: ['Google Cloud Platform (GCP)', 'Cloud Security', 'Kubernetes (GKE)']
      },
      {
        id: 'cert-ms-az400',
        title: 'AZ-400 Designing and Implementing Microsoft DevOps Solutions',
        issuer: 'Microsoft',
        issueDate: 'DEC 2021',
        credentialUrl: 'https://www.credly.com/badges/a0b98fb3-e1b1-4593-bf8b-0e9aba2fcf52?source=linked_in_profile',
        category: 'cloud',
        badgeColor: 'border-cyan-500/40 text-cyan-300',
        skills: ['Microsoft Azure', 'Cloud Security', 'CI/CD Automation']
      },
      {
        id: 'cert-ms-devops-expert',
        title: 'Microsoft Certified: DevOps Engineer Expert',
        issuer: 'Microsoft',
        issueDate: 'VERIFIED',
        credentialUrl: 'https://www.credly.com/badges/9c557196-6d20-4e94-b0b1-383da1dd4b9d?source=linked_in_profile',
        category: 'cloud',
        badgeColor: 'border-cyan-500/40 text-cyan-300',
        skills: ['Microsoft Azure', 'Cloud Security', 'SRE Practices']
      },
      {
        id: 'cert-ms-azure-dev',
        title: 'Microsoft Certified: Azure Developer Associate',
        issuer: 'Microsoft',
        issueDate: 'VERIFIED',
        credentialUrl: 'https://www.credly.com/badges/b8a6c523-a59e-48b1-93f8-5f0a416aba2c?source=linked_in_profile',
        category: 'cloud',
        badgeColor: 'border-cyan-500/40 text-cyan-300',
        skills: ['Microsoft Azure', 'Cloud Security', 'Cloud Solutions']
      },
      {
        id: 'cert-aws-dev-assoc',
        title: 'AWS Certified Developer – Associate',
        issuer: 'Amazon Web Services (AWS)',
        issueDate: 'DEC 2020',
        expiryDate: 'OCT 2026',
        credentialUrl: 'https://www.youracclaim.com/badges/d37d16b8-c833-4e86-8978-09aa478303cf?source=linked_in_profile',
        category: 'cloud',
        badgeColor: 'border-cyan-500/40 text-cyan-300',
        skills: ['Amazon Web Services (AWS)', 'Cloud Security', 'Serverless APIs']
      }
    ]
  },
  {
    id: 'data',
    name: 'Data, Systems & Professional Programs',
    count: 2,
    certs: [
      {
        id: 'cert-guvi-python',
        title: 'Python',
        issuer: 'HCL GUVI',
        issueDate: 'FEB 2021',
        credentialId: 'P6C961L3730699Y9s1',
        credentialUrl: 'https://www.guvi.in/certificate?id=P6C961L3730699Y9s1',
        category: 'data',
        badgeColor: 'border-cyan-500/40 text-cyan-300',
        skills: ['Python (Programming Language)', 'Algorithmic Foundations']
      },
      {
        id: 'cert-ms-mta-python',
        title: 'MTA: Introduction to Programming Using Python - Certified 2020',
        issuer: 'Microsoft',
        issueDate: 'NOV 2020',
        credentialUrl: 'https://www.youracclaim.com/badges/8678562b-ef0c-4c34-889b-4a6c83d78d53?source=linked_in_profile',
        category: 'data',
        badgeColor: 'border-cyan-500/40 text-cyan-300',
        skills: ['Python (Programming Language)', 'Object-Oriented Programming']
      }
    ]
  }
];

export const CERTIFICATIONS: Certification[] = CERTIFICATION_CATEGORIES.flatMap((c) => c.certs);

export const AWARDS_BY_ORGANIZATION = [
  {
    organization: 'Cisco Systems Inc.',
    tagline: 'ASSOCIATED WITH CISCO · SAN JOSE, CA',
    awards: [
      {
        id: 'award-cisco-ptw-sep2026',
        title: 'Play to Win Connected Recognition',
        organization: 'Cisco Systems Inc.',
        date: 'SEP 2026',
        category: 'STO Data Platform Launch',
        description: 'Awarded for exceptional delivery and leadership during the Cisco STO Data Platform Launch as part of Project Atlas.',
        associatedWith: 'Cisco'
      },
      {
        id: 'award-cisco-ptw-aug2026',
        title: 'Play to Win Connected Recognition',
        organization: 'Cisco Systems Inc.',
        date: 'AUG 2026',
        category: 'Play to Win Together',
        description: 'Recognized for collaborative engineering excellence in driving platform milestones within Cisco STO CTO Operations.',
        associatedWith: 'Cisco'
      }
    ]
  },
  {
    organization: 'HCL America Inc. / HCLTech',
    tagline: 'ASSOCIATED WITH HCL AMERICA INC. & HCLTECH · CISCO ACCOUNT',
    awards: [
      {
        id: 'award-hcl-kc-mar2026',
        title: 'ERS Knowledge Champion 🥇',
        organization: 'HCL America Inc.',
        date: 'MAR 2026',
        category: 'Architecture Leadership',
        description: 'For hard work, dedication and commitment across enterprise cloud security deliverables.',
        associatedWith: 'HCL America Inc.'
      },
      {
        id: 'award-hcl-kc-dec2025',
        title: 'ERS Knowledge Champion 🥇',
        organization: 'HCL America Inc.',
        date: 'DEC 2025',
        category: 'Technical Contribution',
        description: 'For excellent contributions in architecting multi-cloud vulnerability orchestration.',
        associatedWith: 'HCL America Inc.'
      },
      {
        id: 'award-hcl-star-mar2025',
        title: 'ERS Star Champion 🥇',
        organization: 'HCL America Inc.',
        date: 'MAR 2025',
        category: 'High Impact Delivery',
        description: 'For excellent contributions to vulnerability orchestration and AI document retrieval.',
        associatedWith: 'HCL America Inc.'
      },
      {
        id: 'award-hcl-champ-feb2025',
        title: 'You are a champion 🥇',
        organization: 'HCL America Inc.',
        date: 'FEB 2025',
        category: 'Delivery Excellence',
        description: 'For excellent contributions in delivering high-assurance security engineering.',
        associatedWith: 'HCL America Inc.'
      },
      {
        id: 'award-hcl-champ-jan2025',
        title: 'You are a champion 🥇',
        organization: 'HCL America Inc.',
        date: 'JAN 2025',
        category: 'Excellence in Execution',
        description: 'For excellent contributions in standardising security project tooling and automation.',
        associatedWith: 'HCL America Inc.'
      },
      {
        id: 'award-hcl-star-dec2024',
        title: 'ERS Star Champion 🥇',
        organization: 'HCL America Inc.',
        date: 'DEC 2024',
        category: 'Outstanding Achievement',
        description: 'For excellent contributions across multi-cloud pipeline deployments.',
        associatedWith: 'HCL America Inc.'
      },
      {
        id: 'award-hcl-achieve-o4',
        title: 'HCL Achievers League - O4 🥇',
        organization: 'HCLTech',
        date: 'AUG 2024',
        category: 'League of Champions',
        description: 'For Excellent Contributions to the SVIC JupiterOne API and security graph analytics.',
        associatedWith: 'HCLTech'
      },
      {
        id: 'award-hcl-achieve-o3',
        title: 'HCL Achievers League - O3 🥇',
        organization: 'HCLTech',
        date: 'MAR 2023',
        category: 'League of Champions',
        description: 'For Excellent Contributions on the UCT/CSBIT cloud compliance scanning platform.',
        associatedWith: 'HCLTech'
      },
      {
        id: 'award-hcl-shining-mar2023',
        title: 'Shining Star 🥇',
        organization: 'HCLTech',
        date: 'MAR 2023',
        category: 'Operational Excellence',
        description: 'For Excellent Contributions to the compliance pipeline v5 stream processing framework.',
        associatedWith: 'HCLTech'
      },
      {
        id: 'award-hcl-shining-dec2022',
        title: 'Shining Star 🥇',
        organization: 'HCLTech',
        date: 'DEC 2022',
        category: 'Technical Innovation',
        description: 'For Excellent Contributions and high-impact delivery.',
        associatedWith: 'HCLTech'
      },
      {
        id: 'award-hcl-kc-aug2022',
        title: 'ERS Knowledge Champions 🥇',
        organization: 'HCLTech',
        date: 'AUG 2022',
        category: 'Knowledge Sharing',
        description: 'For ERS Knowledge Champion and mentoring engineering teams.',
        associatedWith: 'HCLTech'
      },
      {
        id: 'award-hcl-achieve-o2',
        title: 'HCL Achievers League - O2 🥇',
        organization: 'HCLTech',
        date: 'MAR 2022',
        category: 'League of Champions',
        description: 'For Excellent Contributions in microservices architecture and cloud compliance.',
        associatedWith: 'HCLTech'
      },
      {
        id: 'award-hcl-tech-mar2022',
        title: 'Technical Excellence 🥇',
        organization: 'HCLTech',
        date: 'MAR 2022',
        category: 'Technical Innovation',
        description: 'For Technical Excellence on the Cisco cloud security audit orchestration platform.',
        associatedWith: 'HCLTech'
      },
      {
        id: 'award-hcl-deliv-sep2021',
        title: 'Delivery Excellence 🥇',
        organization: 'HCLTech',
        date: 'SEP 2021',
        category: 'Delivery Excellence',
        description: 'For Excellent delivery on multi-cloud security scan ingestion pipelines.',
        associatedWith: 'HCLTech'
      },
      {
        id: 'award-hcl-spark-apr2021',
        title: 'Spark Award',
        organization: 'HCLTech',
        date: 'APR 2021',
        category: 'Proactive Innovation',
        description: 'For Splendid performance towards the deliverables in the Cisco Continuous Security Buddy Project.',
        associatedWith: 'HCLTech'
      },
      {
        id: 'award-hcl-kc-sep2020',
        title: 'ERS Knowledge Champions 🥇',
        organization: 'HCLTech',
        date: 'SEP 2020',
        category: 'Knowledge Sharing',
        description: 'For ERS Knowledge Champion and establishing standardized Python frameworks.',
        associatedWith: 'HCLTech'
      }
    ]
  },
  {
    organization: 'Tata Consultancy Services',
    tagline: 'ASSOCIATED WITH TATA CONSULTANCY SERVICES · 5+ YEARS',
    awards: [
      {
        id: 'award-tcs-service-2019',
        title: 'Service Commitment 🥇',
        organization: 'Tata Consultancy Services',
        date: 'JAN 2019',
        category: 'Corporate Dedication',
        description: 'For 5+ Years of commitment and technical leadership.',
        associatedWith: 'Tata Consultancy Services'
      },
      {
        id: 'award-tcs-spot-2017',
        title: 'On the Spot 🥇',
        organization: 'Tata Consultancy Services',
        date: 'AUG 2017',
        category: 'Outstanding Contribution',
        description: 'For Outstanding Contribution to the Organization in client delivery and system engineering.',
        associatedWith: 'Tata Consultancy Services'
      }
    ]
  }
];

export const AWARDS: Award[] = AWARDS_BY_ORGANIZATION.flatMap((org) => org.awards);

export const EDUCATION = [
  {
    degree: 'Bachelor of Engineering (B.E.)',
    field: 'Computer Science and Engineering',
    institution: 'Visvesvaraya Technological University (VTU)',
    period: '2006 — 2010',
    grade: '9.5/10 CGPA · FIRST CLASS WITH DISTINCTION',
    location: 'Karnataka, India',
    details: 'Rigorous 4-year curriculum covering computer systems architecture, operating systems, data structures and algorithms, database management, computer networks, and software engineering principles.'
  },
  {
    degree: 'Associate in Science',
    field: 'Physics, Chemistry, Mathematics & Biology (PCMB)',
    institution: 'Department of Pre-University Education',
    period: '2004 — 2006',
    grade: 'PRE-UNIVERSITY MERIT',
    location: 'Karnataka, India',
    details: 'Foundational studies in analytical physics, chemistry, higher mathematics, biology, and scientific reasoning.'
  }
];

export const ANNOUNCEMENTS = [
  {
    id: 'ann-1',
    date: 'OCTOBER 2026',
    title: 'Cisco STO Data Platform Launch & Connected Recognition',
    summary: 'Awarded Cisco Play to Win Connected Recognition for building the security data platform at the core of Project Atlas.'
  },
  {
    id: 'ann-2',
    date: 'APRIL 2026',
    title: 'Databricks AI Agent & Fundamentals Accreditations Completed',
    summary: 'Successfully achieved official Databricks Academy Accreditations in AI Agent Fundamentals and Databricks Fundamentals.'
  },
  {
    id: 'ann-3',
    date: 'MARCH 2026',
    title: '4th Consecutive ERS Champion Award on Cisco Account',
    summary: 'Recognized by HCL America Inc. for outstanding architecture on multi-cloud vulnerability orchestration and AI document retrieval.'
  }
];

export const LINKEDIN_RECOMMENDATIONS: Recommendation[] = [
  {
    id: 'rec-omar-khalid',
    author: 'Omar Khalid',
    role: 'Architect & Software Systems Engineer',
    date: 'NOV 2023',
    relationship: 'Worked with Mohammed on the same team',
    relationshipType: 'peer',
    featured: true,
    quote: 'I highly recommend Mohamed due to his exceptional dependability and commitment. His diligent approach to problem-solving ensures that tasks are handled meticulously and with utmost dedication, consistently delivering high-quality work. Mohamed\'s energetic demeanor not only motivates those around him but also contributes positively to the team\'s dynamics. I confidently endorse Mohamed for his reliability, quality output, and contagious enthusiasm in any professional setting.'
  },
  {
    id: 'rec-sudarshana-ms',
    author: 'Sudarshana M S',
    role: 'Technology & Engineering Colleague',
    date: 'MAY 2023',
    relationship: 'Worked with Mohammed on the same team',
    relationshipType: 'peer',
    quote: 'I had the pleasure of working with many professionals in our line of work, but Sufyan is someone who I will always remember fondly. Not only he has good programming skills, but he helped me navigate the company\'s internal processes. Definitely would love to work again with Sufyan. He\'s always willing to lend a hand to anyone who needs it. Watching him adapt to our ever-changing business landscape was an inspiration! His ability to overcome challenges with a smile made him stand out as a cut above the rest! Any company would be lucky to have Sufyan on their team.'
  },
  {
    id: 'rec-abhishek-ghimire',
    author: 'Abhishek Upadhyaya Ghimire',
    role: 'Cloud Engineering Technical Leader at Cisco',
    date: 'MAY 2023',
    relationship: 'Worked with Mohammed on the same team',
    relationshipType: 'peer',
    featured: true,
    quote: 'I had a pleasure of working with Mohammed in a Cloud Security project for 2 years. He is diligent and has attention to details. He never shied away from asking questions, which made sure that he delivered the features that were expected for the project. He was always available for discussing any technical features and supporting our customers. I would recommend Mohammed to any team.'
  },
  {
    id: 'rec-rakesh-chandrappa',
    author: 'Rakesh Chandrappa',
    role: 'Senior Technical Lead',
    date: 'MAY 2023',
    relationship: 'Senior colleague alongside Mohammed',
    relationshipType: 'peer',
    quote: 'It gives me great pleasure to recommend Sufyan for any professional endeavors. I have had the pleasure of working alongside Sufyan for Actian and have been consistently impressed by his exceptional work ethic, dedication, and commitment to producing outstanding results. Sufyan has a rare combination of both technical and interpersonal skills, which makes him an invaluable asset to any team. He\'s a skilled developer with exceptional problem-solving skills, with extensive experience in Automation and Application development. He consistently displays an ability to think creatively and outside the box.'
  },
  {
    id: 'rec-justin-tang',
    author: 'Justin Tang',
    role: 'Information Security',
    date: 'APR 2023',
    relationship: 'Managed Mohammed directly',
    relationshipType: 'manager',
    featured: true,
    quote: 'Mohammed is very detailed in his work and demonstrates the ability to understand a problem in order to solve it. He quickly picks up on new technology and does not shy away from the challenge. He delivers quality work in his software development and will continue to fine tune what he produces for improvement. Mohammed is a great team player and is able to collaborate effectively with his technical peers, project managers, and management. I highly recommend Mohammed for any team!'
  },
  {
    id: 'rec-laxmi-prasad-sahu',
    author: 'Laxmi Prasad Sahu',
    role: 'Technical Specialist',
    date: 'FEB 2022',
    relationship: 'Worked with Mohammed on the same team',
    relationshipType: 'peer',
    quote: 'Sufyan is a very good Python programmer and coworker. A quick learner interested to explore latest technologies. Very good in container and cloud platform.'
  },
  {
    id: 'rec-manje-gowda',
    author: 'MANJE GOWDA K S',
    role: 'Python Backend Engineer · AWS, GenAI, LLMs, RAG, AI Agents & APIs',
    date: 'OCT 2021',
    relationship: 'Reported to Mohammed directly',
    relationshipType: 'direct_report',
    featured: true,
    quote: 'Sufyan is one of the best among all people I have ever met and is a loyal colleague, understands complex matters. He is a strong and goal oriented team player; with every problem there was a solution. His goal-oriented approach and motivation to team members leads the team to achieve goals with higher possibilities. Highly recommended.'
  },
  {
    id: 'rec-saifullah-kazi',
    author: 'Saifullah Kazi',
    role: 'Lead Engineer, Infrastructure & Endpoint Automation Specialist',
    date: 'OCT 2021',
    relationship: 'Worked with Mohammed on the same team',
    relationshipType: 'peer',
    quote: 'I\'m amazed by Mohammed Sufyan\'s ability as a developer, a skill he uses to his benefit when making presentations to clients and colleagues. He is a highly focused person as well as analytical and can add to any team he is a part of. His energy to make things happen was contagious and it helped us achieve great goals. One of the best developers we had for sure.'
  },
  {
    id: 'rec-gowtham-r',
    author: 'GOWTHAM R',
    role: 'IT Analyst (ITA)',
    date: 'OCT 2021',
    relationship: 'Worked with Mohammed on the same team',
    relationshipType: 'peer',
    quote: 'Mr. Sufyan Mohammed brings all his skills and abilities to the table as a Technical Lead. He is reliable and very goal-oriented, which inspired our team to try our best always. The other characteristics that made him such a great Technical Lead were his analytical capacity and kindness. He knows how to bring the best out of each person and is an outstanding mentor.'
  },
  {
    id: 'rec-lathish-naidu',
    author: 'Lathish Naidu',
    role: 'Software Engineer (SE3)',
    date: 'OCT 2021',
    relationship: 'Worked with Mohammed on the same team',
    relationshipType: 'peer',
    quote: '"Genuine expert" is the phrase that comes to mind when I think about Mr. Sufyan Mohammed.'
  },
  {
    id: 'rec-neha-gupta',
    author: 'Neha Gupta',
    role: 'Sr Software Engineer at Itron Inc. · Ex Capgemini, Ex HCL Tech',
    date: 'SEP 2021',
    relationship: 'Reported to Mohammed directly',
    relationshipType: 'direct_report',
    quote: 'Mohammed is highly enthusiastic about the work and an excellent professional who knows how to work in multiple culture & diversity, his problem solving skills are superb. He can handle any kind of projects and can complete in commendable fashion on time. It is worth working with such a person, I would not hesitate to recommend him.'
  },
  {
    id: 'rec-shanjeev-rajendran',
    author: 'Shanjeev Rajendran',
    role: 'Principal Data Engineer · Snowflake, dbt, Airflow, Python, AWS · SnowPro Core, CKAD',
    date: 'SEP 2021',
    relationship: 'Worked with Mohammed on the same team',
    relationshipType: 'peer',
    featured: true,
    quote: 'Sufyan has an innate ability to learn any skill in a short timeframe. When we were working, he went from knowing nothing about the subject to subject matter expert within a month. He is also very approachable and a joy to work with. I would highly recommend Sufyan for projects that need high technical abilities.'
  },
  {
    id: 'rec-asthik-hebbar',
    author: 'Asthik Hebbar',
    role: 'Sr Software Engineer at Cognizant',
    date: 'AUG 2021',
    relationship: 'Worked with Mohammed across teams',
    relationshipType: 'peer',
    quote: 'Mr Sufyan Mohammed is a talented, motivated, forward thinking software developer who has lots of knowledge in his field. Broad-minded Engineer — his exceptional workflow, skills, ingenuity and comprehension of change requests made the project a dream. Mr Sufyan leads by example and many people at TCS find his enthusiasm and dedication both inspiring and motivating. I highly recommend Mohammed.'
  },
  {
    id: 'rec-shashikiran-shetty',
    author: 'Shashikiran Shetty K',
    role: 'Senior Systems Engineer at Apple',
    date: 'AUG 2021',
    relationship: 'Worked with Mohammed on the same team',
    relationshipType: 'peer',
    featured: true,
    quote: 'We both started our IT career together in TCS. I had the pleasure to work with Mohammed for 2 years in the same project. He is well organised, diligent, and a fast learner. Discipline and balance are what characterizes his leadership. As a candidate who exhibits exemplary technical expertise & leadership quality, Mohammed earns my highest recommendation.'
  },
  {
    id: 'rec-pradnya-patil',
    author: 'Pradnya Patil',
    role: 'Senior Data & Insight Lead (Public Sector) · Power BI · SQL · DAX',
    date: 'JUL 2021',
    relationship: 'Worked with Mohammed on the same team',
    relationshipType: 'peer',
    quote: 'I have worked with Sufyan for quite a significant amount of time. He has great technical knowledge and also had good domain knowledge. He was one of the go-to associates of our team. Easily approachable and has great knowledge sharing ability.'
  },
  {
    id: 'rec-arpitha-patil',
    author: 'Arpitha Patil',
    role: 'SDE II · Cloud-First Product Engineering',
    date: 'JUL 2021',
    relationship: 'Mohammed was senior to Arpitha',
    relationshipType: 'peer',
    quote: 'Sufyan and I briefly worked together at TCS. He was an asset to the team and very approachable. Being technically very efficient and strong, he was dependable and worked really well under pressure. He was always courteous and in good spirits, making the work environment more enjoyable. He would be a great addition to any team and company.'
  },
  {
    id: 'rec-sahil-ahmed',
    author: 'Sahil Ahmed',
    role: 'Software Engineering Colleague',
    date: 'JUL 2021',
    relationship: 'Worked with Mohammed across companies',
    relationshipType: 'peer',
    quote: 'A person with great skill set — focused, dedicated & disciplined. Always ready to accept and work on new technology based on requirement — he has the capability to make things possible to work. I truly believe he is a valuable resource for existing and upcoming technology, flexible and always ready to take challenges no matter how critical the demand is. I highly recommend Mohammed for any software development position.'
  },
  {
    id: 'rec-shijia-hu',
    author: 'Shijia Hu',
    role: 'DevOps Engineer at Huatai Securities Co., Ltd.',
    date: 'JUL 2021',
    relationship: 'Worked with Mohammed on the same team',
    relationshipType: 'peer',
    quote: 'Mohammed is a person with great skills and profound experience of modern business solutions. He thinks on the cutting edge of programming, software development, Python and AWS. Excellent and result driven. He is ready to deal with difficult situations and solve the problems on time. I was impressed by his manner of doing a great job. I highly recommend Mohammed and would love to work with him again.'
  },
  {
    id: 'rec-ganesh-chandan',
    author: 'Ganesh Chandan',
    role: 'Senior Software Engineering · Application Architecture & Technical Leadership',
    date: 'JUL 2021',
    relationship: 'Worked with Mohammed across companies',
    relationshipType: 'peer',
    quote: 'Sufyan is a very skilled and talented Python Developer. I have indirectly worked with Sufyan for over 3 years and he is exceptional in his dedication to work. He always went the extra mile to make things better. It was always a pleasure working with Sufyan.'
  },
  {
    id: 'rec-rakshith-kumar',
    author: 'Rakshith Kumar',
    role: 'Senior Software Engineer · Microservices, Python, Django, Flask, Kafka',
    date: 'JUL 2021',
    relationship: 'Worked with Mohammed on the same team',
    relationshipType: 'peer',
    quote: 'I had worked with Mr. Sufyan Mohammed in one of the projects. He is one of the valuable members of the team who would bring in innovative ideas to optimize the work. I would highly recommend him for any challenging role due to his breadth of skills.'
  },
  {
    id: 'rec-sharukh-ainan',
    author: 'Sharukh Ainan',
    role: 'Member of Technical Staff',
    date: 'JUL 2021',
    relationship: 'Mohammed was senior to Sharukh',
    relationshipType: 'peer',
    quote: 'Know him as an excellent optimistic person who brings an enormous amount of energy into the project. Acknowledge the commitment and crucial role played by him to deliver the Python test automation effortlessly. Very innovative and consistent in optimised coding. Good team player with great work ethics.'
  },
  {
    id: 'rec-ravikiran-shetty',
    author: 'Ravikiran Shetty K',
    role: 'Data Analyst at Lithium Urban Technologies',
    date: 'JUL 2021',
    relationship: 'Worked with Mohammed across teams',
    relationshipType: 'peer',
    quote: 'Very good at design and development. Quick learner, hard-working, and always eager to take up challenging tasks. He will be a great addition to any development team as he gets things done on time and with quality. I highly recommend Sufyan for any software development position.'
  },
  {
    id: 'rec-alex-medovar',
    author: 'Alex Medovar',
    role: 'Engineering Manager @ Rubrik',
    date: 'JUL 2021',
    relationship: 'Managed Mohammed directly',
    relationshipType: 'manager',
    featured: true,
    quote: 'Mohammed joined my team as a contractor and performed beyond expectations. I was extremely satisfied to see the great work ethic and coding capabilities Mohammed brought to the team. Anything I asked Mohammed to do, he did quickly and correctly. He is never afraid to ask questions.'
  }
];
