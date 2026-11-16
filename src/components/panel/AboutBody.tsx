import CopyEmail from "@/components/CopyEmail";
import { ABOUT, PERSON } from "@/data/site";
import styles from "./AboutBody.module.css";

export default function AboutBody() {
  return (
    <div className={styles.root}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>About me</p>
        <h2 className={styles.greeting}>{ABOUT.greeting}</h2>
        <p className={styles.lead}>{ABOUT.lead}</p>
        <p className={styles.body}>{ABOUT.body}</p>

        <p className={styles.company}>
          {`${PERSON.company.role}, ${PERSON.company.name} · ${PERSON.company.tagline}`}
        </p>

        <div className={styles.ctas}>
          <CopyEmail email={PERSON.email} className={styles.primaryBtn} />
          <a href={PERSON.cv} download className={styles.secondaryBtn}>
            Download CV
          </a>
          <a
            href={PERSON.github}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.secondaryBtn}
          >
            GitHub ↗
          </a>
        </div>

        <p className={styles.meta}>{`${PERSON.base} · ${PERSON.languages}`}</p>
      </header>

      <section className={styles.section}>
        <h3 className={styles.sectionHeading}>What I do</h3>
        <div className={styles.servicesGrid}>
          {ABOUT.services.map((service, index) => (
            <article key={service.title} className={styles.card}>
              <span className={styles.cardNum}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <h4 className={styles.cardTitle}>{service.title}</h4>
              <p className={styles.cardText}>{service.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionHeading}>Experience</h3>
        <ul className={styles.expList}>
          {ABOUT.experience.map((item) => (
            <li key={`${item.years}-${item.org}`} className={styles.expRow}>
              <span className={styles.expYears}>{item.years}</span>
              <div className={styles.expContent}>
                <p className={styles.expRole}>{`${item.title} · ${item.org}`}</p>
                <p className={styles.expText}>{item.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionHeading}>Skills</h3>
        <div className={styles.skillsGroups}>
          {ABOUT.skills.map((group) => (
            <div key={group.group} className={styles.skillGroup}>
              <h4 className={styles.skillLabel}>{group.group}</h4>
              <ul className={styles.skillChips}>
                {group.items.map((item) => (
                  <li key={item} className={styles.chip}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
