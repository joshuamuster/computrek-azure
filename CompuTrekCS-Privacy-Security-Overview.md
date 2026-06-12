# CompuTrek CS — Student Privacy & Security Overview
**Prepared by:** Joshua Muster, 7th Grade Computer Science, Computrek Middle School  
**Date:** May 2026  
**Submitted to:** FUSD Technology Department  

---

## 1. What Is CompuTrek CS?

CompuTrek CS is a custom-built classroom management and learning platform used exclusively in Mr. Muster's 7th grade Computer Science classes at Computrek Middle School. It is not a commercial product and is not shared with, sold to, or operated by any third party. The application runs on Google Firebase (a Google Cloud platform) and is accessible only to students and staff with provisioned accounts.

The platform provides:
- A student dashboard with class assignments, a mission-based curriculum, and progress tracking
- Typing training and assessment tools
- A teacher broadcast interface for live class management (CHAMPS behavior system, countdown timers)
- An administrative interface for teachers to manage seating charts, conduct scoring, and student records

---

## 2. What Student Data Is Collected and Why

The following table describes every category of student data stored in the system:

| Data Field | What It Is | Why It's Stored | Where It Lives |
|---|---|---|---|
| Display name | Student's first and last name | Shown on the student dashboard and teacher roster | Firestore (`approvedUsers`) |
| Generated login email | A fabricated address (e.g. `student682972@computrekcs.edu`) | Used as a login identifier — **not a real email address** | Firestore + Firebase Auth |
| Student ID number | FUSD student ID | Used only to derive the initial temporary password; not displayed anywhere | Firestore (`approvedUsers`) |
| Role | `cadet` (student), `staff`, or `admin` | Controls what pages and features the student can access | Firestore (`approvedUsers`) |
| Period ID | Which class period the student is enrolled in | Associates students with their teacher and class section | Firestore (`approvedUsers`) |
| Teacher email | The assigning teacher's school email | Links the student to their teacher for data isolation | Firestore (`approvedUsers`) |
| Conduct score | A numerical classroom behavior score | Displayed to student and teacher; used for CHAMPS tracking | Firestore (`approvedUsers`) |
| Assignment submissions | Completion status and teacher feedback on missions | Tracks student progress and enables grading | Firestore (`submissions`) |
| Typing results | Words per minute, accuracy, lesson completion | Drives the typing curriculum and progress dashboard | Firestore (`typingResults`) |
| Password (hashed) | Student's chosen login password | Authentication — **never stored in readable form** | Firebase Authentication only |

### What is NOT collected

- Real student email addresses
- Home address, phone number, or any contact information
- Biometric data of any kind
- Browsing history or behavioral data outside the application
- Photos or images of students
- Social Security numbers or health information

---

## 3. Identity and Authentication Design

### Fake Email Scheme (Privacy by Design)

Students do not log in with their real FUSD email address. Instead, each student is provisioned a fabricated login identity in the format:

```
student{studentID}@computrekcs.edu
```

This domain does not exist and receives no email. It is used purely as a unique login identifier within Firebase Authentication. The effect is that **no real personal contact information is stored in or transmitted through the authentication layer.**

This approach was chosen specifically to limit PII exposure. If the Firebase project were ever compromised, the authentication records would contain fabricated identifiers rather than real student email addresses.

### Initial Password and Forced Reset

Students receive a temporary first-login password derived from their first name and the last two digits of their student ID (e.g., a student named Joshua with ID ending in 72 receives `joshua72`). This password is **never stored** — it is only used once. On first login, the application immediately forces the student to choose a new password before accessing any content.

The new password is stored exclusively in Firebase Authentication as a bcrypt hash. It is not written to Firestore, is not visible to the teacher, and cannot be read by any part of the application.

### Password Requirements

Firebase Authentication enforces a minimum of 6 characters. Students are prompted to confirm the password before it is accepted.

---

## 4. Data Access Controls (Who Can See What)

Access to data is enforced at the database level through Firebase Firestore Security Rules — not just at the application level. This means that even if a user attempted to access data directly through the Firebase API, the rules would block them.

### Student Access

A logged-in student can:
- Read their own profile (name, period, conduct score)
- Read and update their own assignment submissions
- Read assignments published to their class period
- Write their own typing results
- Read shared class resources (missions, leaderboards)

A student **cannot**:
- Read any other student's profile, submissions, or scores
- Read or write teacher or admin data
- Modify their own role, period assignment, teacher, or student ID
- Access data from other class periods

### Teacher Access

Teachers can read and write data for students assigned to their own class periods. A teacher cannot access student records belonging to another teacher's class.

### Admin Access

One designated administrator account has full read/write access for provisioning accounts and managing the system. This account uses a real school email address and is protected by Google's standard authentication security.

### Firestore Rule Highlights

The following constraints are enforced directly in Firestore Security Rules (not just application code):

- A student can update only two fields on their own profile record: their Firebase UID (backfilled at first login) and the `requiresPasswordChange` flag (cleared only after a successful forced password reset, and only settable to `false`)
- A teacher can update only the `conductScore` field on student records belonging to their own class
- No student can write to another student's record under any rule
- All other profile writes require admin-level access

---

## 5. Data Sharing and Third Parties

**No student data is shared with any third party.** The platform has no advertising, no analytics SDK beyond what Firebase provides for operational purposes, no social login, and no integrations with external services.

The only external service that processes student data is **Google Firebase / Google Cloud**, which provides:
- Firebase Authentication (password management)
- Cloud Firestore (database)
- Firebase Hosting (web server)

Google's infrastructure is used under Google's standard Terms of Service for Firebase. The question of whether FUSD has a Data Processing Agreement (DPA) with Google Cloud that formally extends to Firebase is the subject of this submission.

---

## 6. Alignment with Applicable Privacy Law

### COPPA (Children's Online Privacy Protection Act)
CompuTrek CS is designed to minimize PII collection for users under 13. The fake-email scheme means no real contact information is collected. No behavioral profiling, advertising, or data monetization occurs. The school-official exception under COPPA (16 C.F.R. § 312.5(b)(1)) is intended to apply here — the school consents on behalf of parents for educational tools. Formalizing this through the district's software approval process is the appropriate path.

### SOPIPA (California Student Online Personal Information Protection Act, AB 1584)
The application does not sell student information, use it for targeted advertising, build profiles on students outside of the educational purpose, or disclose covered information to third parties. Data collected is limited to what is necessary for the educational function. These practices align with SOPIPA requirements for operators of school services.

### FERPA (Family Educational Rights and Privacy Act)
Education records generated by the platform (assignments, grades, conduct scores) are accessible only to the student themselves and their assigned teacher. No records are disclosed outside the school environment. District responsibility for FERPA compliance is met through normal oversight of classroom tools.

---

## 7. Data Minimization and Retention

The system collects only what is necessary to operate the classroom. Specifically:

- Student ID numbers are used only to generate the temporary first-login password. They are retained in the profile record for administrative reference but are never displayed to students or used for any other function.
- Typing results are retained for the duration of the school year to track progress.
- Conduct scores are per-period records updated by the teacher.
- No data from prior school years is retained after the end-of-year data purge (performed manually by the teacher/admin).

There is no automated retention policy currently implemented at the infrastructure level. Data purging is performed manually by the administrator account at the end of each school year.

---

## 8. Infrastructure Security

- **Transport:** All traffic between the browser and Firebase is encrypted via TLS (HTTPS). The application is served over Firebase Hosting with HTTPS enforced.
- **Authentication:** Firebase Authentication handles all credential management. Passwords are stored as bcrypt hashes and are never transmitted in plaintext after initial submission.
- **Database:** Cloud Firestore is a managed Google Cloud database with server-side security rules as described in Section 4.
- **Hosting:** The application is served from Firebase Hosting (Google's CDN), with no custom server infrastructure to maintain or patch.
- **No server-side code:** The application has no custom backend server. All logic runs in the browser (Vue.js) or is enforced by Firebase's own infrastructure. There is no application server that could be compromised to expose data.

---

## 9. Open Question: Google Cloud DPA

The one item requiring district confirmation is whether FUSD has an active **Data Processing Agreement (DPA)** with Google Cloud that covers Firebase services. Google Workspace for Education carries explicit FERPA/COPPA compliance certifications and a Business Associate Agreement. Firebase operates under Google Cloud's general Terms of Service, which provides strong technical protections but may not carry the same formal compliance certifications without a separate agreement.

**Requested action:** Please confirm whether FUSD's existing Google agreement (Workspace for Education or otherwise) extends to Google Cloud / Firebase, or advise on the process to obtain a DPA that covers this application.

If a formal software approval submission is required, this document is intended to support that process.

---

## 10. Summary

| Question | Answer |
|---|---|
| Does the app collect real student email addresses? | No — fabricated identifiers only |
| Does the app collect student contact information? | No |
| Are student passwords readable by teachers or admins? | No — Firebase Auth, bcrypt hashed |
| Can students access other students' data? | No — enforced at the database rule level |
| Is student data sold or shared with third parties? | No |
| Is the app used for advertising or profiling? | No |
| What external service processes the data? | Google Firebase (Google Cloud) |
| Is there a required district action? | Confirm or obtain Google Cloud DPA |

---

*This document was prepared by Joshua Muster and reflects the technical design of the CompuTrek CS application as of May 2026. Questions may be directed to jmuster@computrekcs.edu.*
