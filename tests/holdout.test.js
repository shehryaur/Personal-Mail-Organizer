// Hand-written test emails with known answers (blind holdout set, written from the
// spec only). Data only: used by trainer/train.js --synthetic and tests/eval-models.js.
// Received: Wednesday 14 Oct 2026, mid-morning US Pacific.
const RECEIVED = new Date('2026-10-14T16:30:00Z');

// ---- Expectation kinds ----
// ACTION: must be job-related, stage in `stage`, action_needed, not archived, starred.
// REJECT: job-related, stage rejected, label Jobs/Rejected, archived is fine/expected.
// RECEIPT: job-related, stage applied (or `stage`), not starred, not labelled interview/assessment/offer.
// DEADLINE: ACTION + exact deadline.
// NONJOB: prefilter false.
// Tricky cases carry custom expectations.

const cases = [];
const add = (kind, name, from, subject, body, exp = {}) => cases.push({ kind, name, from, subject, body, exp });

// ===================== 15 MUST-STAY-VISIBLE =====================
add('ACTION', 'indirect: "would love to find 30 min"', 'Dana Whitfield <dana@corvelle.io>', 'Following up on your application',
  'Hi Sam,\n\nThanks for applying for the Product Designer role. The team really liked your portfolio and we would love to find 30 minutes for you to chat with our design lead. Could you send over a few times that work for you next week?\n\nBest,\nDana', { stage: ['interview'] });
add('ACTION', 'Goodtime scheduling link', 'Lumora Talent <no-reply@goodtime.io>', 'Action required: pick your times with Lumora',
  'Hello Sam,\n\nLumora has invited you to select times for your Onsite Loop (4 x 45 min). Please use the link below to choose your slots.\n\nhttps://app.goodtime.io/select/abc123\n\nThis link expires in 72 hours.\n\nGoodTime on behalf of Lumora', { stage: ['interview'] });
add('ACTION', 'buried in long recruiter email', 'Priya Natarajan <priya.n@hollowpeak.com>', 'Hollowpeak <> Sam',
  'Hi Sam,\n\nHope your week is going well! I wanted to give you a little background on Hollowpeak first. We were founded in 2019 and now serve over 400 logistics customers across North America. Our design team is 12 people, split between the Fleet product and the new Warehouse product. We do quarterly offsites, we have a strong writing culture, and we care a lot about craft.\n\nThe role you applied for sits in the Warehouse pod and works closely with two PMs and about eight engineers. Day to day you would own the receiving and putaway flows end to end.\n\nAnyway, the reason for my note: the hiring manager would like to do a 45-minute portfolio review with you. Let me know your availability for Tuesday or Wednesday.\n\nCheers,\nPriya\nSenior Recruiter | Hollowpeak\n+1 415 555 0134', { stage: ['interview'] });
add('ACTION', 'bullet list next steps', 'careers@tindral.com', 'Next steps - Tindral',
  'Hi Sam,\n\nGreat news, you are moving forward! Here is what happens next:\n\n- Step 1: 30 min call with the hiring manager\n- Step 2: Design exercise (async, ~3 hrs)\n- Step 3: Panel with the team\n\nReply with three time slots for step 1.\n\nTindral Recruiting', { stage: ['interview', 'assessment'] });
add('ACTION', 'signature-heavy, tiny ask', 'Marcus Oyelaran <marcus@brightwell-partners.com>', 'Re: Sr. UX role',
  'Sam - are you free Thu for a quick call w/ the hiring mgr?\n\n--\nMarcus Oyelaran\nPrincipal, Technology Search\nBrightwell Partners LLC\n100 Pine St, Suite 1200 | San Francisco, CA 94111\nM: +1 415 555 0199 | O: +1 415 555 0100\nwww.brightwell-partners.com\nCONFIDENTIALITY NOTICE: This email and any attachments are for the exclusive and confidential use of the intended recipient. If you are not the intended recipient, please do not read, distribute or take action in reliance upon this message.', { stage: ['interview'] });
add('ACTION', 'mobile-written with typos', 'Jen Kowalski <jen@pebblestack.dev>', 'quick q',
  'hey sam saw ur aplication for the design role, can u hop on a call tmrw or fri? lmk what works\n\nSent from my iPhone', { stage: ['interview'] });
add('ACTION', 'emoji-heavy startup invite', 'Team Zingo <hello@zingo.app>', '🎉 You made it to the next round!',
  'Hey Sam 👋\n\nWe loved your application 💜 and want to get to know you better! Grab a slot on our calendar for a casual chat with the founders ☕\n\n👉 https://cal.com/zingo/founders-chat\n\nTalk soon 🚀\nZingo', { stage: ['interview'] });
add('ACTION', 'Portuguese interview invite', 'Recrutamento Vellora <recrutamento@vellora.com.br>', 'Convite para entrevista - Designer de Produto',
  'Olá Sam,\n\nObrigado pelo seu interesse na vaga de Designer de Produto. Gostaríamos de convidá-lo para uma entrevista com a nossa equipe na próxima semana. Por favor, responda com a sua disponibilidade.\n\nAtenciosamente,\nEquipe de Recrutamento Vellora', { stage: ['interview'] });
add('ACTION', 'Italian interview invite', 'HR Ferrandi <selezione@ferrandi-studio.it>', 'Colloquio per la posizione di UX Designer',
  'Gentile Sam,\n\nla ringraziamo per la sua candidatura. Saremmo lieti di invitarla a un colloquio conoscitivo online. Ci indichi per favore le sue disponibilità per la prossima settimana.\n\nCordiali saluti,\nUfficio Selezione Ferrandi', { stage: ['interview'] });
add('ACTION', 'Hinglish recruiter call', 'Rohit Mehra <rohit@talentkaro.in>', 'Design role - call kal?',
  'Hi Sam, aapka profile client ko bahut pasand aaya. Kal 11 baje ek quick call ho sakta hai hiring manager ke saath? Please confirm kar do.\n\nThanks,\nRohit\nTalentKaro Staffing', { stage: ['interview'] });
add('ACTION', 'agency acting for client', 'Laura Benning <laura.benning@harrowrecruit.co.uk>', 'Exciting opportunity - our client would like to meet you',
  'Hi Sam,\n\nI represent a Series B fintech client (confidential for now). They reviewed the CV I submitted on your behalf and would like to arrange a first-stage video call with their Head of Design. Can you share your availability over the next few days?\n\nKind regards,\nLaura Benning\nHarrow Recruitment', { stage: ['interview'] });
add('ACTION', 'Codility test via ATS', 'Nexora Hiring <no-reply@codility.com>', 'Nexora invites you to a Codility test',
  'Hello Sam,\n\nNexora has invited you to complete an online test as part of your application for Frontend Engineer. The test takes about 90 minutes. Start the test here: https://app.codility.com/test/XYZ\n\nGood luck!', { stage: ['assessment'] });
add('ACTION', 'design exercise as "homework"', 'Ines Calder <ines@quarrylabs.com>', 'Small design homework for you',
  'Hi Sam,\n\nAs the next stage we would like you to work on a short design problem at home. The brief is attached. Please send back your Figma file and a short write-up when you are done.\n\nThanks!\nInes, Quarry Labs', { stage: ['assessment'] });
add('ACTION', 'verbal offer, "good news"', 'Tom Ashby <tom@meridianworks.com>', 'Good news!',
  'Sam,\n\nI am thrilled to let you know the team would like to extend you an offer for the Product Designer position! I will send the written offer letter tomorrow. Could we set up a quick call to walk through compensation and start date?\n\nTom\nHead of Talent, Meridian Works', { stage: ['offer'] });
add('ACTION', 'reference check request', 'Greta Holm <greta@solsticehealth.com>', 'References',
  'Hi Sam,\n\nWe are in the final stage of our process for the Senior Designer role. Could you please send us the names and contact details of two professional references by reply?\n\nThank you,\nGreta Holm\nSolstice Health Talent Team', { stage: ['interview', 'offer', 'other'] });

// ===================== 12 REJECTIONS =====================
add('REJECT', 'soft: "position has been filled"', 'Kestrel Careers <careers@kestrel.ai>', 'Update on your application',
  'Hi Sam,\n\nThank you for your interest in the Product Designer role at Kestrel. We wanted to let you know that the position has now been filled. We will keep your details on file for future openings.\n\nKestrel Talent');
add('REJECT', '"not the right fit at this time"', 'no-reply@greenhouse.io', 'Your application to Arbor Systems',
  'Dear Sam,\n\nThank you for applying to Arbor Systems. After careful review, we have determined that your experience is not the right fit for this role at this time. We wish you the best in your search.\n\nArbor Systems Recruiting');
add('REJECT', '"we will not be proceeding"', 'Talent <talent@northvale.co>', 'Northvale - Senior UX Designer',
  'Hi Sam,\n\nThanks for taking the time to interview with us. Having discussed internally, we will not be proceeding with your application. We appreciate your interest.\n\nNorthvale');
add('REJECT', '"chosen to move ahead with others"', 'hiring@cobaltcurve.com', 'Re: Design Lead',
  'Hi Sam,\n\nThank you for your patience. The team has chosen to move ahead with candidates whose experience more closely matches our needs. Thank you again for your interest in Cobalt Curve.');
add('REJECT', 'very long, rejection at the end', 'Alicia Moreno <alicia@verdantloop.com>', 'Thank you from Verdant Loop',
  'Hi Sam,\n\nFirst of all, thank you so much for the time you spent with our team over the last three weeks. Everyone who met you enjoyed the conversations, especially the deep dive on your accessibility audit work, which sparked a long discussion afterwards. Your portfolio presentation was thoughtful and clearly structured, and the panel appreciated how you handled the questions on trade-offs. We also want to recognise the effort you put into the take-home exercise, which was polished and well reasoned.\n\nThis was an unusually strong pool and the decision took us longer than expected, which is why you have not heard from us until now. We are sorry about the wait.\n\nUltimately, we have decided to offer the role to another candidate. This was a difficult call and it is not a reflection on your abilities. We would love to stay in touch.\n\nWarmly,\nAlicia');
add('REJECT', '"regret to inform"', 'Workday <noreply@myworkdayjobs.com>', 'Regarding your application for Job R-10234',
  'Dear Sam,\n\nWe regret to inform you that you have not been selected for the role of UX Designer II (R-10234). We encourage you to apply for future positions.\n\nSincerely,\nTalent Acquisition, Halberd Corp');
add('REJECT', '"won\'t be moving to the next stage"', 'Lever <no-reply@hire.lever.co>', 'Update from Plumeria',
  'Hi Sam,\n\nThanks for your interest in Plumeria. We won\'t be moving your application to the next stage of our process. Best of luck with your search!\n\nPlumeria Team');
add('REJECT', 'role closed / headcount freeze', 'People Ops <people@tessellate.io>', 'Product Designer role update',
  'Hi Sam,\n\nUnfortunately due to a change in business priorities, the Product Designer role has been closed and we are no longer hiring for it. We are sorry for any inconvenience and appreciate the time you invested.\n\nTessellate People Ops');
add('REJECT', 'Portuguese rejection', 'Vagas Lumen <vagas@lumen.com.br>', 'Retorno sobre o processo seletivo',
  'Olá Sam,\n\nAgradecemos sua participação no nosso processo seletivo. Infelizmente, decidimos seguir com outros candidatos neste momento. Desejamos sucesso na sua carreira.\n\nEquipe Lumen');
add('REJECT', 'Ashby, "decided not to move forward"', 'Orbitly <no-reply@ashbyhq.com>', 'Your application at Orbitly',
  'Hi Sam,\n\nThank you for applying to the Senior Product Designer role. After reviewing your application, the team has decided not to move forward at this time.\n\nOrbitly Recruiting');
add('REJECT', '"pursue other applicants" + future roles', 'recruiting@halcyonbio.com', 'Halcyon Bio application status',
  'Dear Sam,\n\nThank you for your application. We received many strong applications and have elected to pursue other applicants for this position. We will retain your CV and may reach out if a suitable role opens up.\n\nHalcyon Bio');
add('REJECT', 'post-interview, "unable to offer"', 'Mia Chen <mia.chen@lanternpay.com>', 'Following up after your interviews',
  'Hi Sam,\n\nThank you for meeting the team last week. I am sorry to share that we are unable to offer you the position. Feedback was positive on your craft but we need someone with more payments domain experience.\n\nBest,\nMia');

// ===================== 10 RECEIPTS / STATUS =====================
add('RECEIPT', 'Greenhouse "we\'re reviewing"', 'no-reply@greenhouse.io', 'Thanks for applying to Fernwood',
  'Hi Sam,\n\nThanks for applying to Fernwood! Our team is reviewing your application and will be in touch if your qualifications match our needs.\n\nFernwood Recruiting');
add('RECEIPT', '"application is under review"', 'Workday <noreply@myworkdayjobs.com>', 'Application status: Under Review',
  'Dear Sam,\n\nYour application for Senior Product Designer (R-55120) is currently under review. You can check your status at any time in the candidate portal.\n\nCalderon Group');
add('RECEIPT', 'LinkedIn "profile viewed"', 'LinkedIn <jobs-noreply@linkedin.com>', 'Your application was viewed by Brindle',
  'Sam, your application for UX Designer at Brindle was viewed by the hiring team.\n\nView job | Unsubscribe');
add('RECEIPT', 'SmartRecruiters submitted', 'SmartRecruiters <noreply@smartrecruiters.com>', 'Application submitted: Product Designer at Quillon',
  'Hi Sam,\n\nYour application for Product Designer at Quillon has been successfully submitted. Quillon will contact you if they would like to move forward.');
add('RECEIPT', 'iCIMS acknowledgement', 'Talent Team <no-reply@icims.com>', 'We received your application',
  'Dear Sam,\n\nThis is to acknowledge receipt of your application for Interaction Designer at Rowan Medical. Due to the volume of applications we may not respond individually.\n\nRowan Medical Talent Team');
add('RECEIPT', 'Workable "still reviewing" update', 'Workable <noreply@workable.com>', 'An update on your application to Stellwagen',
  'Hi Sam,\n\nJust a quick note: we are still reviewing applications for the Design Systems Lead role and expect to share an update within two weeks. No action is needed from you.\n\nStellwagen');
add('RECEIPT', 'Lever confirmation casual tone', 'Lever <no-reply@hire.lever.co>', 'Got it! 🙌',
  'Hey Sam, we got your application for the Brand Designer role at Mosswell. Someone from the team will take a look soon!');
add('RECEIPT', 'Indeed "application sent"', 'Indeed <indeedapply@indeed.com>', 'Application submitted: UX Researcher',
  'Your application has been submitted to Pinegate Analytics.\n\nUX Researcher - Remote\nWhat happens next: the employer will review your application.');
add('RECEIPT', 'status moved to "In review" portal', 'Ashby <no-reply@ashbyhq.com>', 'Application update - Tidewell',
  'Hi Sam,\n\nThe status of your application for Product Designer at Tidewell has changed to: In Review.\n\nTidewell Hiring');
add('RECEIPT', 'Wellfound "employer saw your profile"', 'Wellfound <team@wellfound.com>', 'Quantix viewed your profile',
  'Good news, Sam! Quantix viewed your profile after you applied to Senior Designer. Keep your profile up to date to stand out.');

// ===================== 10 DEADLINES (received Wed 2026-10-14) =====================
add('DEADLINE', '"end of next week"', 'Hannah Liu <hannah@corbelstudio.com>', 'Design exercise',
  'Hi Sam,\n\nAs discussed, here is the design exercise. Please submit your solution by the end of next week.\n\nThanks,\nHannah', { stage: ['assessment'], deadline: '2026-10-23' });
add('DEADLINE', '"by the 31st"', 'no-reply@greenhouse.io', 'Complete your take-home for Wexley',
  'Hi Sam,\n\nPlease complete the take-home assignment for the Product Designer role by the 31st. Upload it via the link below.\n\nWexley Recruiting', { stage: ['assessment'], deadline: '2026-10-31' });
add('DEADLINE', '"Monday EOD PT"', 'Ryan Patel <ryan@fathomgrid.com>', 'Case study for next round',
  'Hey Sam, please send the case study deck over by Monday EOD PT so the panel can review before your interview. Thanks!', { stage: ['assessment', 'interview'], deadline: '2026-10-19' });
add('DEADLINE', '"within 24h"', 'Recruiting <recruiting@sablecore.io>', 'Confirm your interview slot',
  'Hi Sam,\n\nWe have tentatively booked your interview. Please confirm within 24h or the slot will be released.\n\nSablecore', { stage: ['interview'], deadline: '2026-10-15' });
add('DEADLINE', '"by tomorrow"', 'Olivia Grant <olivia@harborline.com>', 'Availability',
  'Hi Sam, could you send your availability for the final interview by tomorrow? Thanks, Olivia', { stage: ['interview'], deadline: '2026-10-15' });
add('DEADLINE', '"this Friday"', 'CodeSignal <noreply@codesignal.com>', 'Brightmoor invited you to a CodeSignal assessment',
  'Hi Sam,\n\nBrightmoor has invited you to take a General Coding Assessment. Please complete it this Friday at the latest.\n\nCodeSignal', { stage: ['assessment'], deadline: '2026-10-16' });
add('DEADLINE', '"COB Thursday"', 'Nadia Farouk <nadia@ironleaf.co>', 'Portfolio presentation',
  'Hi Sam,\n\nFor your panel interview, please send the portfolio deck by COB Thursday.\n\nNadia', { stage: ['interview', 'assessment'], deadline: '2026-10-15' });
add('DEADLINE', 'deadline inside a table', 'Assessments <assessments@kilnworks.com>', 'Your Kilnworks assessment details',
  'Hi Sam,\n\nHere are the details of your assessment:\n\n| Item      | Detail          |\n|-----------|-----------------|\n| Type      | Design challenge |\n| Duration  | 4 hours         |\n| Deadline  | 28 Oct 2026     |\n\nGood luck!\nKilnworks', { stage: ['assessment'], deadline: '2026-10-28' });
add('DEADLINE', 'deadline after long signature (P.S.)', 'Ben Okafor <ben@rivetsoft.com>', 'Re: next steps',
  'Hi Sam, great chatting today. I am attaching the take-home.\n\nBen Okafor\nEngineering Manager, Rivetsoft\n1 Market St, San Francisco CA\nT: +1 415 555 0177\nrivetsoft.com | @rivetsoft\nThis message may contain confidential information. If you received it in error please delete it.\n\nP.S. Please submit it by November 3.', { stage: ['assessment'], deadline: '2026-11-03' });
add('DEADLINE', '"a week from today"', 'Stella Park <stella@arcadiaml.com>', 'Video submission',
  'Hi Sam,\n\nAs the next step, please record a short video walking through one project. You have a week from today to send it.\n\nStella, Arcadia ML', { stage: ['assessment'], deadline: '2026-10-21' });

// ===================== 8 NON-JOB =====================
add('NONJOB', 'product launch "candidate release"', 'Figma <news@figma.com>', 'Release candidate: new auto layout features',
  'Try the new release candidate of auto layout. Schedule a demo with our team or join the live interview with our product lead on YouTube.');
add('NONJOB', 'school application', 'Admissions <admissions@stanfordgsb.edu>', 'Your application for the MBA program',
  'Dear Sam,\n\nThank you for submitting your application to the MBA program. Your application is under review and admissions decisions will be released in March.');
add('NONJOB', 'apartment rental application', 'Greystar Leasing <leasing@greystar.com>', 'Rental application received - Unit 4B',
  'Hi Sam,\n\nWe received your rental application for Unit 4B. Please schedule a viewing and upload proof of income within 3 days.');
add('NONJOB', 'dating app match', 'Hinge <hello@hinge.co>', 'You have a new match! Thank you for applying your best photos',
  'Sam, Alex liked your profile. Schedule a date and make your interview-proof opener count!');
add('NONJOB', 'scholarship application', 'Fulbright Program <info@fulbright.org>', 'Fulbright application: next steps',
  'Dear applicant,\n\nYour Fulbright scholarship application has been received. Selected candidates will be invited to an interview in January.');
add('NONJOB', 'bank credit application', 'Chase <no-reply@chase.com>', 'Update on your credit card application',
  'Thank you for applying for the Chase Sapphire card. Unfortunately we are not able to approve your application at this time.');
add('NONJOB', 'research grant application', 'NSF FastLane <noreply@nsf.gov>', 'Grant application status',
  'Your grant application #2291 is under review. Reviewers may contact the principal investigator for a short interview.');
add('NONJOB', 'podcast interview request', 'Podcast Booking <booking@designdetails.fm>', 'Interview on Design Details?',
  'Hi Sam, we would love to have you as a guest on the show. Let us know your availability for a 45-min recorded interview.');

// ===================== 5 TRICKY =====================
add('TRICKY', 'reject role A, invite role B', 'Erin Vasquez <erin@lumenforge.com>', 'Your applications at Lumenforge',
  'Hi Sam,\n\nThank you for applying to two roles with us. Unfortunately we will not be moving forward with your application for Senior Visual Designer. However, the team for Product Designer II would love to interview you! Please pick a time here: https://calendly.com/lumenforge/pd2\n\nErin',
  { visible: true, action: true, stage: ['interview'] });
add('TRICKY', 'offer rescinded', 'Paul Ritter <paul@coastalbyte.com>', 'Update regarding your offer',
  'Hi Sam,\n\nI am very sorry to tell you that due to an unexpected restructuring we have to rescind the offer we extended last week for the Product Designer role. Please call me so we can talk about this and any support we can provide.\n\nPaul',
  { visible: true, stage: ['rejected', 'offer', 'other'] });
add('TRICKY', 'application on hold', 'Talent <talent@marrowind.com>', 'Your application - on hold',
  'Hi Sam,\n\nWe wanted to let you know that we have put the hiring for this role on hold for now, and your application is paused. We will reach out if the role reopens.\n\nMarrow Industries',
  { notStage: ['rejected', 'interview', 'assessment', 'offer'] });
add('TRICKY', 'reschedule, no link', 'Kim Alvarez <kim@saltmarsh.io>', 'Need to move our interview',
  'Hi Sam,\n\nSo sorry, our hiring manager is out sick tomorrow. Can we move your interview to early next week? Please let me know which day works best for you.\n\nKim',
  { visible: true, action: true, stage: ['interview'] });
add('TRICKY', 'recruiter out-of-office auto-reply', 'Jordan Blake <jordan.blake@wintergate.com>', 'Automatic reply: Re: Product Designer interview',
  'Thank you for your email. I am out of the office until Monday 19 October with limited access to email. For urgent matters regarding interviews please contact recruiting@wintergate.com.',
  { notStarred: true, notAction: true, notStage: ['rejected', 'offer'] });

module.exports = { cases, RECEIVED };
