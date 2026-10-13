// Award catalog from the Nephrology Nurses Week 2026 proposal.
// type "scored": the committee rates each criterion 1 to 5, and the app applies the weights.
// type "votes": the nominee with the most valid votes wins.

export const RATING_SCALE = [
  { value: 5, label: 'Outstanding' },
  { value: 4, label: 'Very Good' },
  { value: 3, label: 'Satisfactory' },
  { value: 2, label: 'Needs Improvement' },
  { value: 1, label: 'Poor' },
];

export const GROUPS = {
  nurse: { label: 'Nephrology Nurse Awards', noun: 'nurse' },
  na: { label: 'Dialysis Technician Awards', noun: 'dialysis technician' },
};

const c = (label, weight) => ({ label, weight });

export const AWARDS = [
  {
    id: 'hd-nurse', group: 'nurse', type: 'scored',
    title: 'Outstanding Hemodialysis Nurse',
    coverage: 'Main and Annex Units',
    blurb: 'For the hemodialysis nurse whose clinical skill and patient care set the standard on the floor.',
    criteria: [
      c('Clinical competence and patient safety', 30),
      c('Quality of patient care', 25),
      c('Compliance with protocols and documentation', 20),
      c('Teamwork and communication', 15),
      c('Professionalism and accountability', 10),
    ],
  },
  {
    id: 'pd-nurse', group: 'nurse', type: 'scored',
    title: 'Outstanding Peritoneal Dialysis Nurse',
    coverage: 'Peritoneal Dialysis',
    blurb: 'For the peritoneal dialysis nurse who teaches patients and caregivers well and keeps care continuous.',
    criteria: [
      c('Clinical competence and patient safety', 30),
      c('Patient and caregiver education', 25),
      c('Infection prevention and protocol compliance', 20),
      c('Patient follow-up and continuity of care', 15),
      c('Professionalism and teamwork', 10),
    ],
  },
  {
    id: 'nephro-nurse', group: 'nurse', type: 'scored',
    title: 'Outstanding Nephrology Nurse',
    coverage: 'Units within SKTI',
    blurb: 'For the SKTI nurse who gives safe, patient-centered nephrology care every shift.',
    criteria: [
      c('Clinical competence and patient safety', 30),
      c('Quality of patient-centered care', 25),
      c('Compliance with standards and protocols', 20),
      c('Teamwork and communication', 15),
      c('Professionalism and accountability', 10),
    ],
  },
  {
    id: 'team-leader', group: 'nurse', type: 'scored',
    title: 'Best Team Leader',
    coverage: 'Main and Annex Units',
    blurb: 'For the leader who decides well, coordinates the team, and supports the staff.',
    criteria: [
      c('Leadership and decision-making', 25),
      c('Team coordination and management', 25),
      c('Communication and staff support', 20),
      c('Promotion of teamwork and collaboration', 15),
      c('Integrity and professionalism', 15),
    ],
  },
  {
    id: 'team-player', group: 'nurse', type: 'scored',
    title: 'Best Team Player',
    coverage: 'Main and Annex Units',
    blurb: 'For the colleague the team can always count on.',
    criteria: [
      c('Cooperation and teamwork', 30),
      c('Reliability and accountability', 25),
      c('Communication and respect', 20),
      c('Willingness to help colleagues', 15),
      c('Positive attitude and professionalism', 10),
    ],
  },
  {
    id: 'kidney-advocacy', group: 'nurse', type: 'scored',
    title: 'Kidney Health Advocacy Recognition',
    coverage: 'OTSU, SHARE, and Nurse Navigators',
    blurb: 'For the nurse who brings kidney health education and patient advocacy to the community.',
    criteria: [
      c('Kidney health education and awareness', 30),
      c('Patient advocacy and empowerment', 25),
      c('Community engagement and collaboration', 20),
      c('Patient navigation and support', 15),
      c('Commitment and professionalism', 10),
    ],
  },
  {
    id: 'rising-star', group: 'nurse', type: 'scored',
    title: 'Rising Star',
    coverage: 'All Units, newly hired nurses',
    blurb: 'For the newly hired nurse who shows fast growth, initiative, and strong work.',
    criteria: [
      c('Potential and professional growth', 25),
      c('Work performance and competence', 25),
      c('Initiative and willingness to learn', 20),
      c('Teamwork and communication', 15),
      c('Professionalism and accountability', 15),
    ],
  },
  {
    id: 'patient-choice', group: 'nurse', type: 'votes', voter: 'patient',
    title: 'Patient Choice',
    coverage: 'Main and Annex Units',
    blurb: 'Chosen by patients. The nurse with the most valid patient votes receives the award.',
    criteria: [c('Number of valid patient votes', 100)],
  },
  {
    id: 'peer-choice', group: 'nurse', type: 'votes', voter: 'staff',
    title: 'Peer Choice',
    coverage: 'Main and Annex Units',
    blurb: 'Chosen by colleagues. The nurse with the most valid colleague votes receives the award.',
    criteria: [c('Number of valid votes from colleagues', 100)],
  },
  {
    id: 'na-outstanding', group: 'na', type: 'scored',
    title: 'Outstanding Dialysis Technician',
    coverage: 'Dialysis Technicians',
    blurb: 'For overall excellence, professionalism, and commitment to quality dialysis services.',
    criteria: [
      c('Technical competence and proficiency in dialysis procedures', 30),
      c('Compliance with infection prevention, safety protocols, and established standards', 25),
      c('Reliability, punctuality, and accountability in assigned duties', 20),
      c('Teamwork and effective collaboration with nurses and other healthcare personnel', 15),
      c('Professionalism, ethical conduct, and commitment to continuous improvement', 10),
    ],
  },
  {
    id: 'na-lifetime', group: 'na', type: 'scored',
    title: 'Lifetime Dedication to Service',
    coverage: 'Dialysis Technicians',
    blurb: 'For long service that shows dedication, loyalty, and real contributions to the dialysis service.',
    criteria: [
      c('Length and continuity of dedicated service', 30),
      c('Consistent demonstration of commitment and dependability', 25),
      c('Significant contributions to the development and improvement of dialysis services', 20),
      c('Positive influence, mentorship, and knowledge-sharing with colleagues', 15),
      c('Exemplary professional conduct and a legacy of service', 10),
    ],
  },
  {
    id: 'na-patient-care', group: 'na', type: 'scored',
    title: 'Excellence in Patient Care',
    coverage: 'Dialysis Technicians',
    blurb: 'For safe, compassionate, respectful, and patient-centered dialysis care.',
    criteria: [
      c('Patient safety and adherence to established care protocols', 30),
      c('Compassion, respect, and sensitivity to patient needs', 25),
      c('Responsiveness to patient concerns and timely reporting of abnormalities', 20),
      c('Effective communication and collaboration with the healthcare team', 15),
      c('Protection of patient privacy, dignity, and confidentiality', 10),
    ],
  },
  {
    id: 'na-technical', group: 'na', type: 'scored',
    title: 'Technical Excellence',
    coverage: 'Dialysis Technicians',
    blurb: 'For technical skill, accuracy, and the standards that keep dialysis safe and efficient.',
    criteria: [
      c('Proficiency in dialysis machine operation and preparation', 30),
      c('Accuracy in equipment checks, troubleshooting, and documentation', 25),
      c('Compliance with preventive maintenance schedules, disinfection, and safety procedures within assigned responsibilities', 20),
      c('Ability to identify equipment irregularities and promptly report technical concerns', 15),
      c('Commitment to technical learning, skills development, and quality improvement', 10),
    ],
  },
  {
    id: 'na-extra-miler', group: 'na', type: 'scored',
    title: 'Extra Miler',
    coverage: 'Dialysis Technicians',
    blurb: 'For the technician who goes beyond regular duties through initiative and teamwork.',
    criteria: [
      c('Willingness to extend assistance beyond usual assigned responsibilities when needed', 30),
      c('Initiative in identifying and addressing service needs', 25),
      c('Readiness to assist colleagues and support team objectives', 20),
      c('Positive contribution to workflow efficiency and service improvement', 15),
      c('Consistent demonstration of dedication, professionalism, and a positive attitude', 10),
    ],
  },
];

export const awardById = (id) => AWARDS.find((a) => a.id === id);
