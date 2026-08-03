"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div className="container section font-sans" style={{ marginTop: "8%" }}>
      <div className="row center-align">
        <div className="col s12">
          {/* openrouter agent badge */}
          <div 
            className="chip teal lighten-5 teal-text text-darken-3 font-semibold uppercase tracking-wider text-xs"
            style={{ border: "1px solid #e0f2f1" }}
          >
            <i className="material-icons left">flash_on</i>
            powered by openrouter agents
          </div>

          {/* heading block */}
          <div className="section">
            <h1 className="text-3xl md:text-5xl font-light grey-text text-darken-3 uppercase tracking-wide leading-tight">
              Agentic <span className="teal-text text-darken-1 font-bold">RPA Assessment</span>
            </h1>
            <p className="grey-text text-darken-1 font-light max-w-xl mx-auto" style={{ fontSize: "16px", marginTop: "15px" }}>
              Ingest process mining event logs, model transition pathways in custom graphics, and assess automation potential with advanced agentic thought flows.
            </p>
          </div>

          {/* main CTA button */}
          <div className="section">
            <Link href="/upload">
              <button className="btn-large waves-effect waves-light teal darken-1 uppercase tracking-wider font-semibold">
                Get Started
                <i className="material-icons right">arrow_forward</i>
              </button>
            </Link>
          </div>
        </div>
      </div>

      <div className="divider" style={{ margin: "40px 0" }}></div>

      {/* features display grid */}
      <div className="row">
        <div className="col s12 m4">
          <div className="card hoverable" style={{ borderTop: "4px solid #00897b" }}>
            <div className="card-content center-align">
              <div className="section">
                <i className="material-icons medium teal-text text-darken-1">show_chart</i>
              </div>
              <span className="card-title font-semibold uppercase text-sm tracking-wider text-slate-800" style={{ fontSize: "15px", fontWeight: "bold" }}>XES Mining</span>
              <p className="grey-text text-darken-1 font-light" style={{ fontSize: "13px" }}>Interactive Canvas Maps</p>
            </div>
          </div>
        </div>

        <div className="col s12 m4">
          <div className="card hoverable" style={{ borderTop: "4px solid #ef6c00" }}>
            <div className="card-content center-align">
              <div className="section">
                <i className="material-icons medium orange-text text-darken-3">memory</i>
              </div>
              <span className="card-title font-semibold uppercase text-sm tracking-wider text-slate-800" style={{ fontSize: "15px", fontWeight: "bold" }}>AI Metrics</span>
              <p className="grey-text text-darken-1 font-light" style={{ fontSize: "13px" }}>Automated Feasibility Scores</p>
            </div>
          </div>
        </div>

        <div className="col s12 m4">
          <div className="card hoverable" style={{ borderTop: "4px solid #d81b60" }}>
            <div className="card-content center-align">
              <div className="section">
                <i className="material-icons medium pink-text text-darken-1">auto_awesome</i>
              </div>
              <span className="card-title font-semibold uppercase text-sm tracking-wider text-slate-800" style={{ fontSize: "15px", fontWeight: "bold" }}>Multi-Model</span>
              <p className="grey-text text-darken-1 font-light" style={{ fontSize: "13px" }}>Scoring Benchmarking</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
