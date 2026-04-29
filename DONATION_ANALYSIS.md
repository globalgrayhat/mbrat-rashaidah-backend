# DONATION SYSTEM TECHNICAL ANALYSIS

## Document Purpose

Complete reverse-analysis of the donation system based on actual codebase implementation. No assumptions, no improvements - only documented behavior.

---

# 1. FULL SYSTEM REVERSE ANALYSIS

## 1.1 Controllers Layer

| Controller               | Prefix           | Key Endpoints                      |
| ------------------------ | ---------------- | ---------------------------------- |
| DonationsController      | /donations       | POST, GET, payment-status, webhook |
| WebhookController        | /webhooks        | POST myfatoora                     |
| PaymentMethodsController | /payment-methods | GET available, health              |

## 1.2 Services Layer

| Service                      | Responsibility | Key Methods                                          |
| ---------------------------- | -------------- | ---------------------------------------------------- |
| DonationsService             | Orchestration  | create(), handlePaymentWebhook(), reconcilePayment() |
| PaymentService               | Gateway        | createPayment(), getPaymentStatus()                  |
| DonorsService                | Resolution     | resolveOrCreate()                                    |
| OutboxService                | Events         | createEvent(), markAsProcessed()                     |
| PaymentReconciliationService | Recovery       | handleStuckEvents()                                  |

## 1.3 Repository Layer

- DonationRepository: donations CRUD
- PaymentRepository: payments CRUD
- DonorRepository: donors CRUD
- ProjectRepository: update only (increment)
- CampaignRepository: update only (increment)

## 1.4 Entities

```
Donation { id, donorId, paymentId, projectId, campaignId, status, amount, currency }
Payment { id, transactionId, mfPaymentId, status, amount }
Donor { id, userId, email, fullName, isAnonymous }
Project { id, title, targetAmount, currentAmount, donationCount }
Campaign { id, title, targetAmount, currentAmount, donationCount }
OutboxEvent { id, eventType, payload, status, retryCount }
```

---

# 2. SYSTEM ARCHITECTURE DIAGRAM

## 2.1 High-Level Architecture

```mermaid
graph TD
    subgraph CLIENT
        FE[Frontend App]
    end

    subgraph BACKEND["Backend System"]
        subgraph CONTROLLERS
            DC[DonationsController]
            WC[WebhookController]
            PMC[PaymentMethodsController]
        end

        subgraph SERVICES
            DS[DonationsService]
            PS[PaymentService]
            DDS[DonorsService]
            OS[OutboxService]
            PRS[ReconciliationService]
        end

        subgraph REPOS
            DR[DonationRepo]
            PR[PaymentRepo]
            DOR[DonorRepo]
        end
    end

    subgraph EXTERNAL
        MF[MyFatoorah]
        Cron[Scheduler]
    end

    FE -->|HTTP| DC
    FE -->|HTTP| WC
    FE -->|HTTP| PMC

    DC --> DS
    WC --> DS
    PMC --> PS

    DS --> DR
    DS --> PR
    DS --> DOR
    DS --> OS

    PS --> MF
    PRS -->|Every 5min| Cron
    Cron --> PRS
    MF -.->|Webhook| WC
```

## 2.2 Data Flow Architecture

```mermaid
graph LR
    REQUEST[API Request]
    VAL[Validation]
    RES[Donor Resolution]
    TRANS[Transaction]
    INSERT[DB Insert]
    GATEWAY[Payment Gateway]
    OUT[Response]

    REQUEST --> VAL
    VAL --> RES
    RES --> TRANS
    TRANS --> INSERT
    INSERT --> GATEWAY
    GATEWAY --> OUT

    style TRANS fill:#fff8e1
    style GATEWAY fill:#ffe0b2
```

---

# 3. MIND MAP ARCHITECTURE

## 3.1 Complete System Mind Map

```mermaid
graph TD
    ROOT[donation SYSTEM]

    subgraph CREATE["CREATION LAYER"]
        DR["Donor Resolution<br/>- by userId<br/>- by email<br/>- anonymous"]
        VAL["Entity Validation<br/>- project exists<br/>- campaign exists<br/>- isDonationActive"]
        PERSIST["Donation Persistence<br/>- create donations<br/>- create payment<br/>- create outbox"]
    end

    subgraph PAYMENT["PAYMENT LAYER"]
        INIT["Payment Init<br/>- build payload<br/>- call gateway"]
        GW["MyFatoorah<br/>- initiatePayment<br/>- getPaymentStatus"]
        RESP["Response Handling<br/>- get paymentUrl<br/>- link to donations"]
    end

    subgraph OUTBOX["OUTBOX LAYER"]
        EC["Event Creation<br/>- DONATION_PAYMENT_INIT<br/>- persist in same trans"]
        EP["Event Persistence<br/>- status pending<br/>- for recovery"]
        EL["Event Lifecycle<br/>- pending<br/>- processed<br/>- failed"]
    end

    subgraph WEBHOOK["WEBHOOK LAYER"]
        WR["Webhook Reception<br/>- POST /webhooks<br/>- POST /myfatoora"]
        PROC["Event Processing<br/>- parse payload<br/>- find payment"]
        ST["State Transition<br/>- PENDING PAID<br/>- PENDING FAILED"]
    end

    subgraph RECON["RECONCILIATION LAYER"]
        MR["Manual Reconciliation<br/>- by invoiceId<br/>- by paymentId"]
        CR["Cron Recovery<br/>- every 5 minutes<br/>- find stuck events"]
    end

    subgraph RECOV["RECOVERY LAYER"]
        OP["Outbox Processor<br/>- query pending<br/>- check status"]
        MYF["MyFatoorah Query<br/>- getInvoiceStatus<br/>- getPaymentStatus"]
    end

    DR --> VAL
    VAL --> PERSIST
    PERSIST --> INIT
    INIT --> GW
    GW --> WR
    WR --> PROC
    PROC --> ST
    ST --> EL
    CR --> OP
    OP --> MYF

    style CREATE fill:#e8f5e8
    style PAY fill:#fff8e1
    style OUTBOX fill:#e3f2fd
    style WEBHOOK fill:#fce4ec
    style RECON fill:#f1f8e9
    style RECOV fill:#e0e0e0
```

## 3.2 Component Relationships

```mermaid
graph TD
    subgraph CORE["Core Components"]
        DC[Donations Controller]
        DS[Donations Service]
        DD[Donors Service]
    end

    subgraph DATA["Data Layer"]
        DR[Donation Repo]
        PR[Payment Repo]
        DOR[Donor Repo]
    end

    subgraph EXTERNAL["External"]
        MF[MyFatoorah]
    end

    subgraph PATTERNS["Patterns"]
        OUT[Outbox Pattern]
        WEB[Webhook]
        CRON[Cron]
    end

    DC --> DS
    DS --> DR
    DS --> PR
    DS --> DOR
    DS --> DD
    DS --> OUT
    DS --> CRON
    CRON --> MF

    style CORE fill:#bbdefb
    style DATA fill:#c8e6c9
    style EXTERNAL fill:#ffe0b2
    style PATTERNS fill:#e1bee7
```

---

# 4. USER JOURNEY MODELS

## 4.A Registered User Donation Flow

### Complete Sequence Diagram

```mermaid
sequenceDiagram
    participant USER as User
    participant API as API Layer
    participant DS as DonationsService
    participant DR as DonationRepo
    participant PR as PaymentRepo
    participant DOR as DonorRepo
    participant OS as OutboxService
    participant PS as PaymentService
    participant MF as MyFatoorah

    Note over USER,API: Input: {userId, donationItems, currency, paymentMethod}

    USER->>API: POST /donations/create
    API->>DS: create(dto)

    Note over DS,DR: TRANSACTION START

    DS->>DOR: resolveOrCreate by userId
    DOR-->>DS: donor record

    DS->>DR: validate project exists
    DR-->>DS: project validated

    DS->>DR: INSERT donation (PENDING)
    DR-->>DS: donation created

    DS->>PR: INSERT payment (PENDING)
    PR-->>DS: payment created

    DS->>OS: INSERT outbox_event (PENDING)
    OS-->>DS: event created

    Note over DS,DR: TRANSACTION COMMIT

    DS->>PS: createPayment(payload)
    PS->>MF: initiatePayment()

    Note over MF: External Gateway Call

    MF-->>PS: {invoiceId, paymentUrl}
    PS-->>DS: paymentResult

    DS->>PR: Link paymentId to donation
    PR-->>DS: linked

    Note over DS,DR: TRANSACTION COMPLETE

    API-->>USER: {donations, paymentUrl, outboxEvent}

    Note over USER,MF: User redirected to MyFatoorah for payment
```

### Input Structure

```typescript
{
  currency: "KWD",
  paymentMethod: 1,
  donationItems: [{ amount: 100, projectId: "uuid" }],
  donorInfo: { userId: "uuid" }
}
```

### Database Operations

```sql
-- In single transaction:
SELECT * FROM donors WHERE userId = ?
INSERT INTO donations (status='pending') VALUES (?)
INSERT INTO payments (status='pending') VALUES (?)
INSERT INTO outbox_events (eventType='DONATION_PAYMENT_INIT') VALUES (?)
UPDATE donations SET paymentId = ? WHERE id = ?
```

---

## 4.B Guest User Donation Flow

### Sequence Diagram

```mermaid
sequenceDiagram
    participant USER as User
    participant API as API Layer
    participant DS as DonationsService
    participant DOR as DonorRepo
    participant DR as DonationRepo
    participant PR as PaymentRepo
    participant PS as PaymentService
    participant MF as MyFatoorah

    Note over USER,API: Input: {email, donationItems, currency}

    USER->>API: POST /donations/create
    API->>DS: create(dto)

    DS->>DOR: resolveOrCreate by email
    DOR-->>DS: donor record (or create new)

    DS->>DR: validate campaign exists
    DR-->>DS: campaign validated

    DS->>DR: INSERT donation (PENDING)
    DS->>PR: INSERT payment (PENDING)
    DS->>DS: INSERT outbox event

    DS->>PS: createPayment
    PS->>MF: initiatePayment
    MF-->>PS: paymentUrl

    API-->>USER: {donations, paymentUrl}
```

### Input Structure

```typescript
{
  currency: "KWD",
  paymentMethod: 1,
  donationItems: [{ amount: 50, campaignId: "uuid" }],
  donorInfo: {
    email: "guest@example.com",
    fullName: "Guest Name",
    isAnonymous: false
  }
}
```

---

## 4.C Anonymous Donation Flow

### Sequence Diagram

```mermaid
sequenceDiagram
    participant USER as User
    participant API as API Layer
    participant DS as DonationsService
    participant DOR as DonorRepo
    participant DR as DonationRepo
    participant PS as PaymentService
    participant MF as MyFatoorah

    Note over USER,API: Input: {donationItems only - NO donorInfo}

    USER->>API: POST /donations/create
    API->>DS: create(dto)

    DS->>DOR: Create Anonymous Donor<br/>fullName="Anonymous Donor"<br/>isAnonymous=true
    DOR-->>DS: donor.id

    DS->>DR: INSERT donation PENDING

    DS->>DS: INSERT payment PENDING
    DS->>DS: INSERT outbox event

    DS->>PS: createPayment
    PS->>MF: initiatePayment
    MF-->>PS: paymentUrl

    API-->>USER: {donations, paymentUrl}
```

### Input Structure

```typescript
{
  currency: "KWD",
  paymentMethod: 1,
  donationItems: [{ amount: 10, projectId: "uuid" }]
  // NO donorInfo provided
}
```

---

# 5. External Payment Phase (المعاملات الخارجية)

## 5.1 ما الذي يحدث عندما يغادر المستخدم النظام؟

### المشكلة الأساسية

عندما يتم تحويل المستخدم إلى صفحة الدفع (MyFatoorah)، فإن النظام يصبح **لا يعرف شيئاً** عن ما يحدث.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    المراحل الثلاثة للتبرع                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  المرحلة ١: داخل النظام                                              │
│  ┌─────────────────┐                                                  │
│  │ المستخدم يطلب │ ──► إنشاء التبرع ──► دفع المبلغ               │
│  │ التبرع          │      (pending)           (قيد الانتظار)           │
│  └─────────────────┘                                                  │
│         │                                                              │
│         ▼                                                              │
│         ==========================================================================
│                                                                         │
│  المرحلة ٢: خارج النظام (Black Box)                                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                 │   │
│  │    ╔═══════════════════════════════════════╗                      │   │
│  │    ║      صفحة الدفع MyFatoorah          ║                      │   │
│  │    ║                                       ║                      │   │
│  │    ║  • إدخال بيانات البطاقة            ║                      │   │
│  │    ║  • الضغط على زر دفع                 ║                      │   │
│  │    ║  • انتظار النتيجة                   ║                      │   │
│  │    ║                                       ║                      │   │
│  │    ║  • ✓ نجح الدفع                      ║   ✓                 │   │
│  │    ║  • ✗ فشل الدفع                      ║   ✗                 │   │
│  │    ║  • ⊙ إغلاق الصفحة                  ║   ⊙                 │   │
│  │    ║  • ⊙ انقطع الإنترنت                ║   ⊙                 │   │
│  │    ╚═══════════════════════════════════════╝                      │   │
│  │                                                                 │   │
│  │        النظام لا يعرف شيئاً عن أي من هذه الاحتمالات!                │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│         │                                                              │
│         ▼                                                              │
│         ==========================================================================
│                                                                         │
│  المرحلة ٣: العودة للنظام                                             │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐  │
│  │عادة عبر       │     │عادة عبر        │     │عادة عبر        │  │
│  │Webhook          │     │Cron (جدول)      │     │الاستعلام       │  │
│  │(الإشعار)        │     │(كل ٥ دقائق)    │  │يدوي           │  │
│  └─────────────────┘     └─────────────────┘     └─────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 5.2 الاحتمالات الستة عندما يكون المستخدم خارج النظام

| #   | Scenario           | What User Does      | Does System Know? | How to Find Out |
| --- | ------------------ | ------------------- | ----------------- | --------------- |
| 1   | **نجح PAYMENT**    | أكمل الدفع ونجح     | ❌ لا             | Webhook         |
| 2   | **فشل PAYMENT**    | رفضت البطاقة/خطأ    | ❌ لا             | Webhook أو Cron |
| 3   | **أغلق الصفحة**    | أغلق المتصفح        | ❌ لا             | Cron فقط        |
| 4   | **عدsans دون PAY** | ضغط رجوع عاد للصفحة | ❌ لا             | Cron فقط        |
| 5   | **انقطع الإنترنت** | انقطع الإنترنت      | ❌ لا             | Cron فقط        |
| 6   | **توقف المتصفح**   | تجمد المتصفح        | ❌ لا             | Cron فقط        |

### الملخص

> **النظام لا يعرف أي شيء عن حالة الدفع طالما المستخدم خارج النظام!**

الإحتمالات الوحيدة لمعرفة ما حدث:

1. **Webhook** - إذا أرسلت MyFatoorah إشعار للنظام (ليس مضمون!)
2. **Cron** - إذا جاء وقت الفحص الدوري (كل ٥ دقائق)
3. **استعلام يدوي** - إذا طلب المستخدم أو الأدمن معرفة الحالة

---

## 5.3 كيفية عمل النظام لمعرفة حالة الدفع

```mermaid
graph TB
    subgraph "Phase 1: User Leaves System"
        OUT["User redirected<br/>to paymentUrl"]
        MF["MyFatoorah<br/>Payment Page"]
    end

    subgraph "Phase 2: Unknown State (Black Box)"
        EMPTY[("❓ System knows<br/>NOTHING")]
    end

    subgraph "Phase 3: How System Finds Out"
        WEBHOOK["Webhook<br/>from MyFatoorah"]
        CRON["Cron Job<br/>every 5 min"]
        MANUAL["Manual<br/> query"]
    end

    OUT --> MF
    MF --> EMPTY

    WEBHOOK -->|"Best case"| SUCCESS1[✓ Status Known]
    CRON -->|"if webhook missed"| SUCCESS2[✓ Status Known]
    MANUAL -->|"User checks"| SUCCESS3[✓ Status Known]

    style EMPTY fill:#ffcdd2,stroke:#c62828,stroke-width:2px
    style SUCCESS1 fill:#c8e6c9,stroke:#2e7d32,stroke-width:2px
    style SUCCESS2 fill:#c8e6c9,stroke:#2e7d32,stroke-width:2px
    style SUCCESS3 fill:#c8e6c9,stroke:#2e7d32,stroke-width:2px
```

### 5.3.1 الطريقة الأولى: Webhook (الإشعار من MyFatoorah)

```
السيناريو المثالي:

١. المستخدم يكمل الدفع في صفحة MyFatoorah
٢. MyFatoorah ترسل webhook للنظام
٣. النظام يحدث حالة التبرع
٤. كل شيء تمام!


المشكلة:
- MyFatoorah لا ترسل webhook دائماً
- قد يرسل webhook بعد ساعات
- أو قد لا يرسل إطلاقاً!
```

### 5.3.2 الطريقة الثانية: Cron Job (الفحص الدوري)

```
ماذا يفعل Cron كل ٥ دقائق؟

١. يبحث عن جميع التبرعات في حالة "pending"
٢. يسأل MyFatoorah عن حالة كل واحد
٣. إذا تغيرت الحالة، يحدثها في النظام
٤. إذا مر وقت طويل (مثلاً ٢٤ ساعة)، يحددها كفاشلة


الجدول الزمني:

┌──────────────────────────────────────────────────────────────┐
│ وقت الإنشاء    │ ٠      │ ٥     │ ١٠    │ ١٥    │ ٢٠    │
├──────────────────────────────────────────────────────────────┤
│pending        │pending │pending│paid(?) │paid   │paid   │
└──────────────────────────────────────────────────────────────┘
                 ▲      ▲      ▲      ▲      ▲
                 │      │      │      │      └─ Cron discovers
                 │      │      │      └──────── Webhook arrives
                 │      │      └─────────────── Cron checks (status unknown)
                 │      └─────────────────────── Cron checks (status unknown)
                 └────────────────────────── User still on payment page
```

### 5.3.3 الطريقة الثالثة: الاستعلام اليدوي

```
كيف يستطيع المستخدم أو الأدمن معرفة الحالة؟

المستخدم:
- يزور صفحة /invoice/payment/{paymentId}
- أو صفحة /invoice/{invoiceId}

الأدمن:
- يستعلم من لوحة التحكم
- أو يستخدمCron يدوي
```

---

## 5.4 حالة eventual Consistency (الاتساق النهائي)

```mermaid
stateDiagram-v2
    [*] --> PENDING: Payment created<br/>User redirected

    state EXTERNAL {
        [*] --> WAITING
        WAITING --> SUCESS: webhook paid
        WAITING --> FAILED: webhook failed
        WAITING --> TIMEOUT: 24h passed
        WAITING --> MANUAL: user checks
    }

    PENDING --> WAITING

    WAITING --> COMPLETE

    note right of EXTERNAL
        هذه الفترة where النظام
        لا يعرف أي شيء!
        فقط ننتظر أحد три أشياء:
        1. webhook
        2. cron (بعد ٥ دقائق)
        3. استعلام يدوي
    end note
```

### شرح states:

| State        | Meaning                                | When                           |
| ------------ | -------------------------------------- | ------------------------------ |
| **Pending**  | التبرع تم إنشاؤه لكن الدفع لم يتم بعد  | After `POST /donations/create` |
| **Waiting**  | المستخدم على صفحةPaiement, النظام يبحث | User on MyFatoorah page        |
| **Complete** | تم معرفة حالة الدفع                    | webhook/cron/manual            |
| **Timeout**  | مر ٢٤ ساعة بدون علم                    | After 24h                      |

---

## 5.5 Black Box Phase Diagram (مخطط fase الصندوق الأسود)

```mermaid
graph TD
    subgraph "IN SYSTEM"
        A[User creates donation] --> B[Status: PENDING]
        B --> C["Return<br/>paymentUrl"]
    end

    subgraph "EXTERNAL - MyFatoorah"
        C --> D[User on payment page]
        D --> E1["✓ Pays successfully"]
        D --> E2["✗ Payment fails"]
        D --> E3["⊙ Closes page"]
        D --> E4["⊙ No action"]
    end

    subgraph "BLACK BOX - NO SYSTEM KNOWLEDGE"
        E1 -.->|"System knows<br/>NOTHING"| F1[?]
        E2 -.->|"System knows<br/>NOTHING"| F2[?]
        E3 -.->|"System knows<br/>NOTHING"| F3[?]
        E4 -.->|"System knows<br/>NOTHING"| F4[?]

        F1 --> G[WAITING...]
        F2 --> G
        F3 --> G
        F4 --> G
    end

    subgraph "TRIGGERS TO FIND OUT"
        G --> H1[Webhook]
        G --> H2[Cron every 5min]
        G --> H3[Manual query]
    end

    H1 --> I1["✓ Status Found!"]
    H2 --> I2["✓ Status Found!"]
    H3 --> I3["✓ Status Found!"]

    I1 --> J[Update to PAID/FAILED]
    I2 --> J
    I3 --> J

    style G fill:#ffcdd2,stroke:#c62828,stroke-width:2px
    style H1 fill:#fff9c4
    style H2 fill:#e3f2fd
    style H3 fill:#e1bee7
```

---

## 5.6 Possible Outcomes Table

| #   | Scenario                   | User Action         | System Detection  | Recovery Method    |
| --- | -------------------------- | ------------------- | ----------------- | ------------------ |
| 1   | **Payment Success**        | Completes payment   | webhook (or cron) | Auto by webhook    |
| 2   | **Payment Failed**         | Card declined       | webhook (or cron) | Auto by webhook    |
| 3   | **Closes Browser**         | Closes tab/page     | **NONE**          | Cron timeout       |
| 4   | **Returns Without Paying** | Goes back           | **NONE**          | Cron timeout       |
| 5   | **Network Interruption**   | Connection lost     | **NONE**          | Cron timeout       |
| 6   | **No Action**              | Leaves payment page | **NONE**          | Cron timeout (24h) |

---

## 5.7 Eventual Consistency Model

```mermaid
stateDiagram-v2
    [*] --> WAITING: paymentUrl returned

    WAITING --> SUCCESS: webhook paid
    WAITING --> FAILED: webhook failed
    WAITING --> TIMEOUT: no word for 24h

    SUCCESS --> CONSISTENT: status synced
    FAILED --> CONSISTENT: status synced
    TIMEOUT --> CONSISTENT: cron marks as failed

    CONSISTENT --> [*]

    note right of WAITING
        النظام لا يعرف أي شيء!
        يجب انتظار:
        - webhook (غير مضمون)
        - cron كل ٥ دقائق (مضمون)
        - استعلام يدوي
    end note
```

---

## 5.8 Summary for Non-Programmers

### ما الذي يحدث بشكل بسيط:

```
١. المستخدم ينشئ تبرع
   ↓
٢. يتحول لصفحة الدفع (MyFatoorah)
   ↓
٣. ►►►►►►►►►►►►►►►►►►►►►►►►►►►►►►►►►►
      هنا النظام لا يعرف أي شيء!
   ►►►►►►►►►►►►►►►►►►►►►►►►►►►►►►►►►►►
   ↓
٤. واحد من trois أشياء يحدث:

   أ) MyFatoorah ترسل webhook للنظام
      → النظام يعرف الحالة ✓

   ب) Cron يفحص كل ٥ دقائق
      → النظام يعرف الحالة ✓

   ج) المستخدم يستعلم يدوي
      → النظام يعرف الحالة ✓
```

### لماذا هذا مهم؟

- **لا تحذف التبرع من قاعدة البيانات مباشرة** - قد يكون الدفع pending!
- **انتظر ساعة على الأقل** قبل اعتبار التبرع فاشل
- **Cron يعمل كل ٥ دقائق** - سيكتشف eventually
- **Webhook ليس مضموناً** - لا تعتمد عليه فقط

---

# 6. WEBHOOK RECONCILIATION ENGINE

## 6.1 Processing Flow

```mermaid
graph TD
    IN[Webhook Input]
    PAR[Parse Payload]
    FIND[Find Payment]
    CHECK{Already Processed?}
    QUERY[Query MyFatoorah]
    UPDATE[Update Payment Status]
    UPDATE_D[Update Donations]
    MARK[Mark Outbox]
    OUT[Return received true]

    IN --> PAR
    PAR --> FIND
    FIND --> CHECK
    CHECK -->|"No"| QUERY
    CHECK -->|"Yes"| OUT
    QUERY --> UPDATE
    UPDATE --> UPDATE_D
    UPDATE_D --> MARK
    MARK --> OUT

    style CHECK fill:#fff9c4
    style QUERY fill:#ffe0b2
```

## 6.2 Idempotency Logic

```mermaid
graph TD
    WEBHOOK[Webhook Received]
    FIND[Find Payment by transactionId]
    CHECK{status !== 'pending'}
    SKIP[Skip - Already Processed]
    PROCESS[Process Webhook]
    UPDATE[Update Status]
    OUT[Return Success]

    WEBHOOK --> FIND
    FIND --> CHECK
    CHECK -->|"Yes"| SKIP
    CHECK -->|"No"| PROCESS
    PROCESS --> UPDATE
    UPDATE --> OUT

    style CHECK fill:#fff9c4
    style SKIP fill:#c8e6c9
    style PROCESS fill:#c8e6c9
```

---

# 7. OUTBOX PATTERN BEHAVIOR

## 7.1 Event Creation Flow

```mermaid
graph TD
    INPUT[Create Donation]
    VAL[Validate]
    TRANS[Start DB Transaction]
    INS_D[INSERT donations]
    INS_P[INSERT payments]
    INS_O[INSERT outbox_event]
    CALL[Call Payment Gateway]
    COMMIT[Commit Transaction]
    OUT[Response]

    INPUT --> VAL
    VAL --> TRANS
    TRANS --> INS_D
    INS_D --> INS_P
    INS_P --> INS_O
    INS_O --> CALL
    CALL --> COMMIT
    COMMIT --> OUT

    style TRANS fill:#fff8e1
    style INS_O fill:#e3f2fd
```

## 7.2 Event Lifecycle States

```mermaid
stateDiagram-v2
    [*] --> PENDING: Creation

    state PENDING {
        [*] --> CREATED
        CREATED --> DB: Transaction
        DB --> GATEWAY: Call
        GATEWAY --> SUCCESS: Response ok
        GATEWAY --> ERROR: Response fail
    }

    PENDING --> PROCESSED: webhook paid
    PENDING --> FAILED: webhook failed

    PROCESSED --> COMPLETED: confirmed

    FAILED --> DEAD_LETTER: max retries
    FAILED --> CANCELLED: admin action

    COMPLETED --> SUCCESSFUL: final confirmation

    SUCCESSFUL --> [*]
    FAILED --> [*]
    DEAD_LETTER --> [*]

    note right of PENDING
        Cron runs every 5 minutes
        Checks all pending events
        Queries payment status
    end note
```

## 7.3 Cron Processor Flow

```mermaid
graph TD
    CRON[Cron Every 5min]
    QUERY[Query stuck events]
    LOOP["For each event"]
    GET[Get payment status]
    CHECK{Status changed?}
    UPDATE[Update donation]
    MARK[Mark processed]

    CRON --> QUERY
    QUERY --> LOOP
    LOOP --> GET
    GET --> CHECK
    CHECK -->|"Yes"| UPDATE
    CHECK -->|"No"| MARK
    UPDATE --> MARK

    style QUERY fill:#e3f2fd
    style LOOP fill:#fce4ec
```

---

# 8. STATE MACHINE MODEL

## 8.1 Donation State Diagram

```mermaid
stateDiagram-v2
    [*] --> PENDING

    PENDING --> PAID: webhook paid
    PENDING --> FAILED: webhook failed
    PENDING --> FAILED: cron expired

    PAID --> COMPLETED: confirmed

    COMPLETED --> SUCCESSFUL: final

    FAILED --> CANCELLED: admin

    CANCELLED --> [*]
    SUCCESSFUL --> [*]

    note right of PENDING
        Trigger: Donation creation
    end note

    note right of PAID
        Trigger: MyFatoorah webhook
    end note

    note right of FAILED
        Trigger: Failure or timeout
    end note
```

## 8.2 Valid Transitions

```mermaid
graph LR
    A[PENDING] -->|"webhook paid"| B[PAID]
    B -->|"confirmed"| C[COMPLETED]
    C -->|"final"| D[SUCCESSFUL]

    A -->|"webhook failed"| E[FAILED]
    E -->|"admin"| F[CANCELLED]

    style A fill:#e3f2fd
    style B fill:#bbdefb
    style C fill:#90caf9
    style D fill:#42a5f5
    style E fill:#ffcdd2
    style F fill:#ef9a9a
```

## 8.3 Invalid Transitions (Rejected)

```mermaid
graph LR
    E[FAILED] -.-x B[PAID]
    D[SUCCESSFUL] -.-x B
    F[CANCELLED] -.-x B

    style E stroke:#f44336,stroke-dasharray:5
    style D stroke:#f44336,stroke-dasharray:5
    style F stroke:#f44336,stroke-dasharray:5
```

---

# 9. API FLOWS

## 9.A POST /donations/create

```mermaid
graph TD
    SUB1[Input: currency, method, items, donorInfo]
    S1[Validate Input]
    S2[Resolve Donor]
    S3[Validate Project/Campaign]
    S4[DB Transaction]
    S5[INSERT donations PENDING]
    S6[INSERT payments PENDING]
    S7[INSERT outbox event]
    S8[Commit]
    S9[Call MyFatoorah]
    S10[Link payment to donations]
    OUT[Response: donations, paymentUrl]

    SUB1 --> S1
    S1 --> S2
    S2 --> S3
    S3 --> S4
    S4 --> S5
    S5 --> S6
    S6 --> S7
    S7 --> S8
    S8 --> S9
    S9 --> S10
    S10 --> OUT

    style S4 fill:#fff8e1
    style S9 fill:#ffe0b2
```

## 9.B POST /payments/webhook

```mermaid
graph TD
    SUB1[Webhook Payload]
    S1[Parse]
    S2[Find Payment]
    S3{Idempotent?}
    S4[Query MyFatoorah]
    S5[Update Payment Status]
    S6[Update Donations Status]
    S7[Mark Outbox Processed]
    OUT[Return received true]

    SUB1 --> S1
    S1 --> S2
    S2 --> S3
    S3 -->|"No"| S4
    S3 -->|"Yes"| OUT
    S4 --> S5
    S5 --> S6
    S6 --> S7
    S7 --> OUT

    style S3 fill:#fff9c4
```

## 9.C GET /donations/payment-status

```mermaid
graph TD
    INPUT[key, type]
    FIND[Find Payment]
    CHECK{Found?}
    QUERY[Query MyFatoorah]
    UPDATE[Update Status]
    FORMAT[Format Response]
    OUT[Return detailed]

    INPUT --> FIND
    FIND --> CHECK
    CHECK -->|"Yes"| FORMAT
    CHECK -->|"No"| QUERY
    QUERY --> UPDATE
    UPDATE --> FORMAT
    FORMAT --> OUT
```

---

# 10. DATABASE RELATIONSHIPS

## 10.1 Entity Relationship Diagram

```mermaid
graph TD
    D[donations]
    P[payments]
    DO[donors]
    PJ[projects]
    C[campaigns]
    U[users]

    D -->|"FK"| P
    D -->|"FK"| DO
    D -->|"FK"| PJ
    D -->|"FK"| C
    DO -->|"FK"| U

    style D fill:#e3f2fd
    style P fill:#bbdefb
    style DO fill:#c8e6c9
```

## 10.2 FK Dependencies

```mermaid
graph LR
    D[donations.id]
    DO[donors.id]
    P[payments.id]
    PJ[projects.id]
    C[campaigns.id]
    U[users.id]

    D --> DO
    D --> P
    D --> PJ
    D --> C

    DO --> U

    style D fill:#e3f2fd
    style DO fill:#bbdefb
    style P fill:#90caf9
```

---

# 11. SUMMARY

## System Summary

| Component          | Status | Implementation                    |
| ------------------ | ------ | --------------------------------- |
| Donation Creation  | Active | DonationsService.create()         |
| Donor Resolution   | Active | DonorsService.resolveOrCreate()   |
| Payment Gateway    | Active | MyFatoorah only                   |
| Outbox Pattern     | Active | OutboxService + Cron              |
| Webhook Processing | Active | handlePaymentWebhook()            |
| Reconciliation     | Active | Manual + Cron                     |
| Status Tracking    | Active | PENDING PAID COMPLETED SUCCESSFUL |

## Key Behaviors

1. **Transaction-wrapped donation creation** - All in single DB transaction
2. **Outbox crash recovery** - Event persists for gateway failures
3. **Idempotent webhooks** - Duplicate webhooks are ignored
4. **Atomic increments** - currentAmount/donationCount updated atomically
5. **Black box payment** - User leaves system, no direct awareness
6. **Eventual consistency** - Via webhook or cron (5 min)

## Known Workflows

- User creates donation -> Donation created PENDING
- User redirected to paymentUrl -> MyFatoorah handles payment
- MyFatoorah sends webhook -> Status updated to PAID/COMPLETED
- Or: Cron runs 5min -> Stuck donations reconciled
